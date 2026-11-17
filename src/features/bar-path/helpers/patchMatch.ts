import type { GrayFrame } from "../types";

// Matching what an image patch looks like, by normalized cross-correlation,
// which ignores changes in brightness and contrast.

// A patch is compared at every second pixel each way: the look of a plate
// is broad, and it quarters the work.
const PATCH_STEP = 2;

/** Samples per side of a patch `size` pixels wide. */
function samples(size: number): number {
    return Math.ceil(size / PATCH_STEP);
}

/**
 * The square of `size` pixels centred on grid point (cx, cy), at every
 * `PATCH_STEP`th pixel, zero-mean and unit-norm. The centre may fall between
 * pixels: values are interpolated, so the patch is not off by the rounding.
 * Pixels outside the frame repeat the edge.
 */
export function cut(frame: GrayFrame, cx: number, cy: number, size: number): Float32Array {
    const n = samples(size);
    const out = new Float32Array(n * n);
    const left = cx - (size >> 1);
    const top = cy - (size >> 1);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            out[y * n + x] = sample(frame, left + x * PATCH_STEP, top + y * PATCH_STEP);
        }
    }
    normalize(out);
    return out;
}

/** Brightness at grid point (x, y), interpolated between the four pixels around it. */
function sample(frame: GrayFrame, x: number, y: number): number {
    const { data, width, height } = frame;
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    const x0 = Math.floor(cx), y0 = Math.floor(cy);
    const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
    const fx = cx - x0, fy = cy - y0;
    const top = data[y0 * width + x0] * (1 - fx) + data[y0 * width + x1] * fx;
    const bottom = data[y1 * width + x0] * (1 - fx) + data[y1 * width + x1] * fx;
    return top * (1 - fy) + bottom * fy;
}

export function normalize(values: Float32Array) {
    let mean = 0;
    for (let i = 0; i < values.length; i++) mean += values[i];
    mean /= values.length;
    let norm = 0;
    for (let i = 0; i < values.length; i++) {
        values[i] -= mean;
        norm += values[i] * values[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < values.length; i++) values[i] /= norm;
}

/** Normalized cross-correlation of the patch with the frame around grid point (cx, cy), -1 to 1. */
export function correlate(frame: GrayFrame, patch: Float32Array, size: number, cx: number, cy: number): number {
    const { data, width, height } = frame;
    const n = samples(size);
    const left = cx - (size >> 1);
    const top = cy - (size >> 1);
    let sum = 0, sumSq = 0, dot = 0;
    for (let y = 0; y < n; y++) {
        const fy = Math.min(height - 1, Math.max(0, top + y * PATCH_STEP));
        for (let x = 0; x < n; x++) {
            const fx = Math.min(width - 1, Math.max(0, left + x * PATCH_STEP));
            const v = data[fy * width + fx];
            sum += v;
            sumSq += v * v;
            dot += v * patch[y * n + x];
        }
    }
    // The patch is zero-mean, so the window's mean drops out of the dot product.
    const variance = sumSq - (sum * sum) / (n * n);
    return variance > 1e-6 ? dot / Math.sqrt(variance) : 0;
}
