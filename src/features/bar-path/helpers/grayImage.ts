import type { GrayFrame } from "../types";

/** Shrinks a frame by a whole factor, averaging each block of pixels. */
export function downscale(frame: GrayFrame, factor: number): GrayFrame {
    if (factor <= 1) return frame;
    const width = Math.floor(frame.width / factor);
    const height = Math.floor(frame.height / factor);
    const data = new Uint8Array(width * height);
    const area = factor * factor;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let dy = 0; dy < factor; dy++) {
                const row = (y * factor + dy) * frame.width + x * factor;
                for (let dx = 0; dx < factor; dx++) sum += frame.data[row + dx];
            }
            data[y * width + x] = (sum + (area >> 1)) / area;
        }
    }
    return { width, height, data };
}

/** Brightness gradient of a frame (Sobel), with its strength. Border pixels are left at zero. */
export interface Gradient {
    width: number;
    height: number;
    gx: Float32Array;
    gy: Float32Array;
    mag: Float32Array;
}

export function gradient(frame: GrayFrame): Gradient {
    const { width, height, data } = frame;
    const gx = new Float32Array(width * height);
    const gy = new Float32Array(width * height);
    const mag = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const a = data[i - width - 1], b = data[i - width], c = data[i - width + 1];
            const d = data[i - 1], f = data[i + 1];
            const g = data[i + width - 1], h = data[i + width], k = data[i + width + 1];
            const dx = (c + 2 * f + k - a - 2 * d - g) / 8;
            const dy = (g + 2 * h + k - a - 2 * b - c) / 8;
            gx[i] = dx;
            gy[i] = dy;
            mag[i] = Math.sqrt(dx * dx + dy * dy);
        }
    }
    return { width, height, gx, gy, mag };
}

/** The value below which `fraction` of the entries lie (entries are expected within 0 to 255). */
export function quantile(values: Float32Array, fraction: number): number {
    const histogram = new Uint32Array(256);
    for (let i = 0; i < values.length; i++) histogram[Math.min(255, values[i] | 0)]++;
    const target = values.length * fraction;
    let seen = 0;
    for (let v = 0; v < 256; v++) {
        seen += histogram[v];
        if (seen >= target) return v;
    }
    return 255;
}
