import type { GrayFrame, Marker, TrackPoint } from "../types";
import { downscale, downscaleRegion, gradient, quantile } from "./grayImage";
import { correlate, cut, normalize } from "./patchMatch";
import { outlineSupport } from "./plateDetector";

// Frames are shrunk until the plate is about this many pixels in radius:
// enough to place it to a fraction of a pixel, few enough to be quick.
const TRACK_RADIUS = 16;
// How far the plate may stray from where its motion predicts it, per frame, in plate radii.
const REACH_RADII = 0.6;
// Most frames the prediction is close: a small search around it is tried
// first and kept when it finds a peak inside it nearly as good as the last fit.
const NEAR_REACH = 3;
const NEAR_KEEP = 0.9;
// The patch matched for the plate's look: the plate and a rim of what is around it, in plate radii.
const PATCH_RADII = 1.15;
// How much of each confident match flows into the patch, so it follows slow
// changes (light, the plate turning) without drifting off the plate.
const PATCH_BLEND = 0.08;
// Edge threshold limits, as for snapping (see plateDetector).
const EDGE_QUANTILE = 0.6;
const MIN_EDGE = 6;
const MAX_EDGE = 12;
// A fit this good (relative to the first frame's) carries the track on from
// one frame to the next; a lost plate is only picked up again by a clearly
// better one, so the track doesn't settle on something else while it is hidden.
const KEEP_SCORE = 0.4;
const REGAIN_SCORE = 0.55;
// While the plate is hidden, the search widens by this many radii each frame, up to the cap.
const REGAIN_GROWTH_RADII = 0.25;
const REGAIN_MAX_RADII = 2.5;

/**
 * Follows the marked plate from frame to frame by its outline: in each frame,
 * the circle of the plate's size that best fits the edges near where its
 * motion so far predicts it. An outline ignores the plate turning, its colour
 * and the light, and a plate that is one flat colour has little else to follow.
 */
export class PlateTracker {
    private readonly factor: number;
    private readonly patch: Float32Array;
    private readonly patchAnchor: Float32Array;
    private readonly patchSize: number;
    /** Radius in shrunk pixels. */
    private readonly r: number;
    private readonly baseSupport: number;
    /** What counts as an edge, set from the first frame (the light of one video hardly changes). */
    private readonly threshold: number;
    private x: number;
    private y: number;
    private vx = 0;
    private vy = 0;
    private lastT: number | null = null;
    /** Frames in a row the plate has not been found in. */
    private missed = 0;
    /** The last frame's fit, before scaling by the first frame's. */
    private lastFit = 0;

    /** `first` is the frame the marker was placed on. */
    constructor(first: GrayFrame, marker: Marker) {
        this.factor = Math.max(1, Math.round(marker.r / TRACK_RADIUS));
        this.r = marker.r / this.factor;
        this.x = marker.x;
        this.y = marker.y;
        const small = downscale(first, this.factor);
        this.patchSize = 2 * Math.round(PATCH_RADII * this.r) + 1;
        this.patch = cut(small, this.x / this.factor - 0.5, this.y / this.factor - 0.5, this.patchSize);
        this.patchAnchor = this.patch.slice();
        const { g, threshold } = edges(small);
        this.threshold = threshold;
        this.baseSupport = Math.max(0.2, outlineSupport(g, threshold, this.x / this.factor - 0.5, this.y / this.factor - 0.5, this.r));
    }

    /**
     * Where the plate is in `frame`, taken at `t` ms. Only the part of the
     * frame the plate can have reached is shrunk and looked at.
     */
    track(frame: GrayFrame, t: number): TrackPoint {
        const dt = this.lastT == null ? 0 : t - this.lastT;
        // Positions in shrunk pixel-grid coordinates (pixel i's centre is i).
        const lastX = this.x / this.factor - 0.5;
        const lastY = this.y / this.factor - 0.5;
        const reach = Math.max(2, Math.ceil(REACH_RADII * this.r));

        // Where to look: around the prediction, and around the last position
        // in case of a sudden stop or start; or, while the plate is hidden,
        // around where it would be had it kept going, at most a few frames' worth.
        let searches: { x: number; y: number; reach: number }[];
        let needed: number;
        if (this.missed === 0) {
            searches = [
                { x: lastX + (this.vx * dt) / this.factor, y: lastY + (this.vy * dt) / this.factor, reach },
                { x: lastX, y: lastY, reach: 2 * reach },
            ];
            needed = KEEP_SCORE;
        } else {
            const coast = Math.min(this.missed, 5) * dt / this.factor;
            const wider = Math.min(REGAIN_MAX_RADII, REACH_RADII * 2 + REGAIN_GROWTH_RADII * this.missed);
            searches = [{ x: lastX + this.vx * coast, y: lastY + this.vy * coast, reach: Math.ceil(wider * this.r) }];
            needed = REGAIN_SCORE;
        }

        const region = this.region(frame, searches);
        const { left, top } = region;
        const g = gradient(region.frame);
        const look: Look = { frame: region.frame, patch: this.patch, size: this.patchSize };
        const find = (at: { x: number; y: number; reach: number }) => {
            const fit = search(g, this.threshold, look, this.r, at.x - left, at.y - top, at.reach);
            return { x: fit.x + left, y: fit.y + top, score: fit.score };
        };

        let best: Fit | null = null;
        if (this.missed === 0 && this.lastFit > 0) {
            const near = find({ ...searches[0], reach: NEAR_REACH });
            const inside = Math.abs(near.x - searches[0].x) < NEAR_REACH - 0.5 && Math.abs(near.y - searches[0].y) < NEAR_REACH - 0.5;
            if (inside && near.score >= NEAR_KEEP * this.lastFit) best = near;
        }
        best ??= find(searches[0]);
        if (searches.length > 1 && best.score < KEEP_SCORE * this.baseSupport) {
            const around = find(searches[1]);
            if (around.score > best.score) best = around;
        }

        const score = Math.min(1, best.score / this.baseSupport);
        if (score >= needed) {
            const x = (best.x + 0.5) * this.factor;
            const y = (best.y + 0.5) * this.factor;
            if (this.missed === 0 && this.lastT != null && dt > 0) {
                // Smooth the velocity a little so one shaky fit doesn't throw off the next search.
                this.vx = 0.6 * ((x - this.x) / dt) + 0.4 * this.vx;
                this.vy = 0.6 * ((y - this.y) / dt) + 0.4 * this.vy;
            } else {
                this.vx = 0;
                this.vy = 0;
            }
            this.x = x;
            this.y = y;
            this.missed = 0;
            this.lastFit = best.score;
            if (score > 0.8) this.learn(region.frame, best.x - left, best.y - top);
        } else {
            this.missed++;
        }
        this.lastT = t;
        // A frame the plate was not found in reports a score of 0: its position is only the last one known.
        return { t, x: this.x, y: this.y, score: this.missed > 0 ? 0 : score };
    }

    /**
     * The shrunk part of the frame the searches can reach: every centre they
     * try, with the plate's outline and its look around it, cut to the frame.
     */
    private region(frame: GrayFrame, searches: { x: number; y: number; reach: number }[]) {
        const margin = Math.ceil(Math.max(this.r + 2, this.patchSize / 2 + 1));
        const width = Math.floor(frame.width / this.factor);
        const height = Math.floor(frame.height / this.factor);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const s of searches) {
            x0 = Math.min(x0, Math.round(s.x) - s.reach - margin);
            y0 = Math.min(y0, Math.round(s.y) - s.reach - margin);
            x1 = Math.max(x1, Math.round(s.x) + s.reach + margin);
            y1 = Math.max(y1, Math.round(s.y) + s.reach + margin);
        }
        const left = Math.min(width - 1, Math.max(0, x0));
        const top = Math.min(height - 1, Math.max(0, y0));
        const right = Math.max(left, Math.min(width - 1, x1));
        const bottom = Math.max(top, Math.min(height - 1, y1));
        return {
            left, top,
            frame: downscaleRegion(frame, this.factor, left, top, right - left + 1, bottom - top + 1),
        };
    }

    private learn(frame: GrayFrame, x: number, y: number) {
        const seen = cut(frame, x, y, this.patchSize);
        for (let i = 0; i < this.patch.length; i++) {
            this.patch[i] = (1 - PATCH_BLEND) * this.patch[i] + PATCH_BLEND * (0.5 * seen[i] + 0.5 * this.patchAnchor[i]);
        }
        normalize(this.patch);
    }
}

function edges(frame: GrayFrame) {
    const g = gradient(frame);
    const threshold = Math.min(MAX_EDGE, Math.max(MIN_EDGE, quantile(g.mag, EDGE_QUANTILE)));
    return { g, threshold };
}

interface Fit { x: number; y: number; score: number }

/** The plate's look, matched alongside its outline. */
interface Look { frame: GrayFrame; patch: Float32Array; size: number }

/**
 * The best-fitting centre within `reach` pixels of (px, py), refined below a
 * pixel by fitting a parabola through the fits around it. A centre fits by its
 * outline, weighed by how much what it holds looks like the plate: clutter
 * and other plates draw circles too. When several centres fit equally well,
 * the one nearest the prediction wins. The area is scanned at every second
 * centre first, then at every centre around the best of those.
 */
function search(g: ReturnType<typeof gradient>, threshold: number, look: Look, r: number, px: number, py: number, reach: number): Fit {
    const x0 = Math.round(px) - reach;
    const y0 = Math.round(py) - reach;
    const side = 2 * reach + 1;
    const scores = new Float32Array(side * side).fill(NaN);
    let best = -1, bestI = 0, bestD = Infinity;

    const visit = (i: number, j: number) => {
        if (i < 0 || j < 0 || i >= side || j >= side) return;
        const k = j * side + i;
        if (!Number.isNaN(scores[k])) return;
        const outline = outlineSupport(g, threshold, x0 + i, y0 + j, r);
        // The look only matters where an outline could win.
        const likeness = outline > best * 0.5 ? Math.max(0, correlate(look.frame, look.patch, look.size, x0 + i, y0 + j)) : 0;
        const s = outline * (0.25 + 0.75 * likeness);
        scores[k] = s;
        const d = (x0 + i - px) ** 2 + (y0 + j - py) ** 2;
        if (s > best + 1e-6 || (Math.abs(s - best) <= 1e-6 && d < bestD)) {
            best = s;
            bestI = k;
            bestD = d;
        }
    };

    for (let j = 0; j < side; j += 2) for (let i = 0; i < side; i += 2) visit(i, j);
    const ci = bestI % side;
    const cj = (bestI - ci) / side;
    for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) visit(i, j);

    // Climb until the best centre's neighbours are all scored, for the parabola fit.
    let fi: number, fj: number, previous: number;
    do {
        previous = bestI;
        fi = bestI % side;
        fj = (bestI - fi) / side;
        visit(fi - 1, fj); visit(fi + 1, fj); visit(fi, fj - 1); visit(fi, fj + 1);
    } while (bestI !== previous);
    const at = (i: number, j: number) => scores[j * side + i];
    const subX = fi > 0 && fi < side - 1 ? peakOffset(at(fi - 1, fj), best, at(fi + 1, fj)) : 0;
    const subY = fj > 0 && fj < side - 1 ? peakOffset(at(fi, fj - 1), best, at(fi, fj + 1)) : 0;
    return { x: x0 + fi + subX, y: y0 + fj + subY, score: best };
}

function peakOffset(left: number, mid: number, right: number): number {
    const curve = left - 2 * mid + right;
    if (!(curve < 0)) return 0;
    return Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / curve));
}
