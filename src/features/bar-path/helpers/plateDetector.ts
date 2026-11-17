import type { GrayFrame, Marker } from "../types";
import { downscale, gradient, quantile, type Gradient } from "./grayImage";

// Circles are looked for in frames shrunk to about this many pixels on their
// longer side: a plate is still 10 or more pixels across, and it keeps the search cheap.
const DETECT_SIDE = 180;
// What counts as an edge: the stronger 40% of brightness steps, but never so
// few that a plate of a similar grey as what is behind it (a red plate on a
// wooden floor) loses its outline.
const EDGE_QUANTILE = 0.6;
const MIN_EDGE = 6;
const MAX_EDGE = 12;
// A circle needs this much of its outline on an edge to count.
const MIN_SUPPORT = 0.4;
// A plate shows several circles around one centre (rim, lettering, hub); the
// widest one that is nearly as clear as the clearest is its rim.
const RIM_RATIO = 0.85;

/** Plate sizes, as a share of the frame's shorter side. */
const MIN_RADIUS_SHARE = 0.04;
const MAX_RADIUS_SHARE = 0.4;
/** How far from the tap the plate's centre may be, as a share of the frame's shorter side. */
const TAP_REACH_SHARE = 0.06;
/** The marker's size when no outline stands out, as a share of the frame's shorter side. */
const FALLBACK_RADIUS_SHARE = 0.12;

/**
 * The plate around a tap on it: the circle with the clearest outline whose
 * centre is near the tap, widened to the plate's rim. Falls back to a
 * plate-sized circle at the tap when no outline stands out, so the marker is
 * always where it was put and can be resized by hand.
 */
export function snapPlate(frame: GrayFrame, tapX: number, tapY: number): Marker {
    const short = Math.min(frame.width, frame.height);
    const factor = Math.max(1, Math.round(Math.max(frame.width, frame.height) / DETECT_SIDE));
    const g = gradient(downscale(frame, factor));
    const threshold = Math.min(MAX_EDGE, Math.max(MIN_EDGE, quantile(g.mag, EDGE_QUANTILE)));

    const rMin = Math.max(4, Math.round((MIN_RADIUS_SHARE * short) / factor));
    const rMax = Math.round((MAX_RADIUS_SHARE * short) / factor);
    const reach = Math.max(2, Math.round((TAP_REACH_SHARE * short) / factor));
    const cx = Math.round(tapX / factor - 0.5);
    const cy = Math.round(tapY / factor - 0.5);

    // The clearest centre for each radius.
    const byRadius: { x: number; y: number; r: number; support: number }[] = [];
    for (let r = rMin; r <= rMax; r++) {
        let best = { x: cx, y: cy, r, support: 0 };
        for (let y = cy - reach; y <= cy + reach; y++) {
            for (let x = cx - reach; x <= cx + reach; x++) {
                const support = outlineSupport(g, threshold, x, y, r);
                if (support > best.support) best = { x, y, r, support };
            }
        }
        byRadius.push(best);
    }

    const clearest = byRadius.reduce((a, b) => (b.support > a.support ? b : a), byRadius[0]);
    if (!clearest || clearest.support < MIN_SUPPORT) {
        return { x: tapX, y: tapY, r: FALLBACK_RADIUS_SHARE * short };
    }
    // The rim: the widest clear circle around about the same centre.
    const rim = byRadius
        .filter((c) => c.support >= RIM_RATIO * clearest.support
            && Math.hypot(c.x - clearest.x, c.y - clearest.y) <= Math.max(2, 0.2 * c.r))
        .reduce((a, b) => (b.r > a.r ? b : a), clearest);
    return { x: (rim.x + 0.5) * factor, y: (rim.y + 0.5) * factor, r: rim.r * factor };
}

/**
 * Share of a circle's outline that lies on an edge running along it. Parts of
 * the outline outside the frame count as missing, so a plate cut off by the
 * edge of the picture is not widened past it.
 */
export function outlineSupport(g: Gradient, threshold: number, cx: number, cy: number, r: number): number {
    const steps = Math.max(16, Math.round(2 * Math.PI * r));
    let hits = 0;
    for (let s = 0; s < steps; s++) {
        const angle = (2 * Math.PI * s) / steps;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        for (let dr = -1; dr <= 1; dr++) {
            const x = Math.round(cx + (r + dr) * ca);
            const y = Math.round(cy + (r + dr) * sa);
            if (x < 1 || x >= g.width - 1 || y < 1 || y >= g.height - 1) continue;
            const i = y * g.width + x;
            const m = g.mag[i];
            // The edge has to cross the radius, as an outline does (within about 35°).
            if (m >= threshold && Math.abs(g.gx[i] * ca + g.gy[i] * sa) >= 0.82 * m) {
                hits++;
                break;
            }
        }
    }
    return hits / steps;
}
