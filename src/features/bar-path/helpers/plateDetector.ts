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
// widest one that is nearly as clear as the clearest is its rim. They share a
// centre: a wider circle beside it is something else, such as the outline of
// the whole stack of plates seen from below or above.
const RIM_RATIO = 0.85;
const RIM_CENTRE_SHARE = 0.1;

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
            && Math.hypot(c.x - clearest.x, c.y - clearest.y) <= Math.max(2, RIM_CENTRE_SHARE * c.r))
        .reduce((a, b) => (b.r > a.r ? b : a), clearest);
    return { x: (rim.x + 0.5) * factor, y: (rim.y + 0.5) * factor, r: rim.r * factor };
}

/**
 * Share of a circle's outline that lies on an edge running along it. Parts of
 * the outline outside the frame count as missing, so a plate cut off by the
 * edge of the picture is not widened past it.
 *
 * With `ignoredSectors`, the outline is taken in SECTORS equal arcs and that
 * many of the weakest are left out: a plate partly hidden, or passing in
 * front of something as dark as itself, then still fits by the rest.
 */
export function outlineSupport(g: Gradient, threshold: number, cx: number, cy: number, r: number, ignoredSectors = 0): number {
    if (Number.isInteger(cx) && Number.isInteger(cy)) return outlineSupportAtPixel(g, threshold, cx, cy, r, ignoredSectors);
    const { steps, cos, sin } = circleDirections(r);
    const hits = sectorHits.fill(0);
    for (let s = 0; s < steps; s++) {
        const ca = cos[s];
        const sa = sin[s];
        for (let dr = -1; dr <= 1; dr++) {
            const x = Math.round(cx + (r + dr) * ca);
            const y = Math.round(cy + (r + dr) * sa);
            if (hitsOutline(g, threshold, x, y, ca, sa)) {
                hits[sectorOf(s, steps)]++;
                break;
            }
        }
    }
    return combineSectors(hits, steps, ignoredSectors);
}

/**
 * The same for a centre on a pixel, which is what the searches try: the
 * pixels to check are then fixed offsets from it, worked out once per radius.
 */
function outlineSupportAtPixel(g: Gradient, threshold: number, cx: number, cy: number, r: number, ignoredSectors: number): number {
    const { steps, cos, sin, dx, dy, sector } = outlineOffsets(r);
    const { width, height, mag, gx, gy } = g;
    const hits = sectorHits.fill(0);
    // The hottest loop of tracking: hitsOutline is written out here, as Hermes doesn't inline calls.
    for (let s = 0; s < steps; s++) {
        const ca = cos[s];
        const sa = sin[s];
        for (let k = s * 3; k < s * 3 + 3; k++) {
            const x = cx + dx[k];
            const y = cy + dy[k];
            if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) continue;
            const i = y * width + x;
            const m = mag[i];
            if (m >= threshold && Math.abs(gx[i] * ca + gy[i] * sa) >= 0.82 * m) {
                hits[sector[s]]++;
                break;
            }
        }
    }
    return combineSectors(hits, steps, ignoredSectors);
}

const SECTORS = 8;
// Reused for every outline: they are checked one at a time.
const sectorHits = new Int32Array(SECTORS);
const sectorShares = new Float64Array(SECTORS);

function sectorOf(step: number, steps: number): number {
    return Math.floor((step * SECTORS) / steps);
}

/** The share of hits over all sectors but the `ignored` weakest (by their share, as sectors differ by a step in length). */
function combineSectors(hits: Int32Array, steps: number, ignored: number): number {
    if (ignored <= 0) {
        let all = 0;
        for (let k = 0; k < SECTORS; k++) all += hits[k];
        return all / steps;
    }
    const share = sectorShares;
    for (let k = 0; k < SECTORS; k++) {
        const length = Math.floor(((k + 1) * steps + SECTORS - 1) / SECTORS) - Math.floor((k * steps + SECTORS - 1) / SECTORS);
        share[k] = length > 0 ? hits[k] / length : 0;
    }
    share.sort();
    let sum = 0;
    for (let k = ignored; k < SECTORS; k++) sum += share[k];
    return sum / (SECTORS - ignored);
}

/** Whether pixel (x, y) is on an edge that crosses direction (ca, sa) from the centre, as an outline does (within about 35°). */
function hitsOutline(g: Gradient, threshold: number, x: number, y: number, ca: number, sa: number): boolean {
    if (x < 1 || x >= g.width - 1 || y < 1 || y >= g.height - 1) return false;
    const i = y * g.width + x;
    const m = g.mag[i];
    return m >= threshold && Math.abs(g.gx[i] * ca + g.gy[i] * sa) >= 0.82 * m;
}

interface Directions { steps: number; cos: Float64Array; sin: Float64Array }
interface Offsets extends Directions {
    /** Per direction, the pixel offsets at radius r - 1, r and r + 1. */
    dx: Int32Array;
    dy: Int32Array;
    /** Per direction, the sector of the outline it is in. */
    sector: Uint8Array;
}

// Outlines are checked for a handful of sizes thousands of times each: their geometry is worked out once.
const directionsBySteps = new Map<number, Directions>();
const offsetsByRadius = new Map<number, Offsets>();

/** The directions an outline of radius `r` is checked in, one per pixel of its length. */
function circleDirections(r: number): Directions {
    const steps = Math.max(16, Math.round(2 * Math.PI * r));
    let directions = directionsBySteps.get(steps);
    if (!directions) {
        const cos = new Float64Array(steps);
        const sin = new Float64Array(steps);
        for (let s = 0; s < steps; s++) {
            const angle = (2 * Math.PI * s) / steps;
            cos[s] = Math.cos(angle);
            sin[s] = Math.sin(angle);
        }
        directions = { steps, cos, sin };
        directionsBySteps.set(steps, directions);
    }
    return directions;
}

function outlineOffsets(r: number): Offsets {
    let offsets = offsetsByRadius.get(r);
    if (!offsets) {
        const { steps, cos, sin } = circleDirections(r);
        const dx = new Int32Array(steps * 3);
        const dy = new Int32Array(steps * 3);
        const sector = new Uint8Array(steps);
        for (let s = 0; s < steps; s++) {
            sector[s] = sectorOf(s, steps);
            for (let k = 0; k < 3; k++) {
                dx[s * 3 + k] = Math.round((r + k - 1) * cos[s]);
                dy[s * 3 + k] = Math.round((r + k - 1) * sin[s]);
            }
        }
        offsets = { steps, cos, sin, dx, dy, sector };
        offsetsByRadius.set(r, offsets);
    }
    return offsets;
}
