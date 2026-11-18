import type { GrayFrame } from "../../types";

/** Deterministic noise, so the test frames are the same on every run. */
function random(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 2 ** 32;
    };
}

export interface Disc { x: number; y: number; r: number; shade: number }

/**
 * A grey frame with fixed noise, a static decoy plate, and the plate at
 * (x, y): a flat disc with a lighter hub, like a bumper plate seen from the side.
 */
export function drawFrame(width: number, height: number, plate: Disc, decoy?: Disc): GrayFrame {
    const next = random(42);
    const data = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) data[i] = 120 + Math.floor(next() * 30);
    for (const disc of decoy ? [decoy, plate] : [plate]) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const d = Math.hypot(x + 0.5 - disc.x, y + 0.5 - disc.y);
                if (d <= disc.r * 0.15) data[y * width + x] = 220;
                else if (d <= disc.r) data[y * width + x] = disc.shade;
            }
        }
    }
    return { width, height, data };
}

/** Bar height over time for `reps` squats: down for 1 s, up for 1 s, a 0.5 s pause on top. */
export function squatHeight(tMs: number, depthPx: number): number {
    const cycle = 2500;
    const phase = tMs % cycle;
    if (phase < 500) return 0;
    if (phase < 1500) return depthPx * (1 - Math.cos(((phase - 500) / 1000) * Math.PI)) / 2;
    return depthPx * (1 + Math.cos(((phase - 1500) / 1000) * Math.PI)) / 2;
}
