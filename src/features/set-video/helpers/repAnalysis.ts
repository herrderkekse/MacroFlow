import type { BarPathData, Rep, RepAnalysis } from "../types";

// Gaps where the plate was lost are bridged when shorter than this; longer
// ones split the path, and no rep is counted across them.
const MAX_GAP_MS = 350;
// The path is smoothed over about this long: the jitter of the tracking goes,
// the shape of a rep stays.
const SMOOTH_MS = 170;
// Speeds are taken across this long, so a jittery frame doesn't make a peak.
const SLOPE_MS = 130;
// Moving up faster than this counts as lifting.
const MOVING_MPS = 0.05;
// A lift ends when it stops for longer than this, unless the bar did not go
// back down by more than SINK_M before rising again: a grind through a
// sticking point is one rep however long it stalls.
const STALL_MS = 250;
const SINK_M = 0.03;
// ...and as long as what follows the stall is a real part of the rep, not
// lifting the bar into the rack hooks after lockout.
const JOIN_MIN_SHARE = 0.2;
// The least travel that is a rep (the unrack of a bench press is less), also
// as a share of the set's longest: a walkout or rerack is not a rep either.
const MIN_RANGE_M = 0.12;
const MIN_RANGE_SHARE = 0.5;
// Way down: it ends at the bottom of the rep and starts where the bar left the
// top, i.e. was last within this distance of its highest point.
const TOP_TOLERANCE_M = 0.015;
// The way down counts as filmed when it covers at least this share of the way up.
const MIN_LOWERING_SHARE = 0.5;

/**
 * Splits a tracked path into reps. Heights grow upward (frame y grows down);
 * distances come from the plate's real size.
 */
export function analyzeReps(path: BarPathData): RepAnalysis {
    const n = path.t.length;
    const metresPerPx = path.plateDiameterM / (2 * path.marker.r);
    const found = path.score.map((s) => s > 0);
    const confidence = n > 0 ? found.filter(Boolean).length / n : 0;

    const x = smooth(path.t, bridge(path.t, path.x, found));
    const y = smooth(path.t, bridge(path.t, path.y, found));
    const height = y.map((v) => (Number.isNaN(v) ? NaN : -v * metresPerPx));
    const velocity = derivative(path.t, height);

    const phases = joinStalls(liftingPhases(path.t, velocity), height)
        .map(([start, end]) => toTop(height, start, end))
        .map(([start, end]) => ({ start, end, rangeM: height[end] - height[start] }));
    const longest = Math.max(0, ...phases.map((p) => p.rangeM));
    const reps: Rep[] = [];
    let previousEnd = 0;
    for (const { start, end, rangeM } of phases) {
        if (!(rangeM >= MIN_RANGE_M && rangeM >= MIN_RANGE_SHARE * longest)) continue;

        const durationS = (path.t[end] - path.t[start]) / 1000;
        let peak = 0;
        for (let i = start; i <= end; i++) peak = Math.max(peak, velocity[i]);

        const lowering = loweringStart(height, previousEnd, start, rangeM);
        const repStart = lowering ?? start;
        let left = Infinity, right = -Infinity;
        for (let i = repStart; i <= end; i++) {
            left = Math.min(left, x[i]);
            right = Math.max(right, x[i]);
        }

        reps.push({
            startMs: path.t[repStart],
            liftStartMs: path.t[start],
            liftEndMs: path.t[end],
            rangeM,
            meanVelocity: durationS > 0 ? rangeM / durationS : 0,
            peakVelocity: peak,
            loweringMs: lowering == null ? null : path.t[start] - path.t[lowering],
            driftM: (right - left) * metresPerPx,
            startIndex: repStart,
            endIndex: end,
        });
        previousEnd = end;
    }

    const fastest = Math.max(0, ...reps.map((r) => r.meanVelocity));
    const last = reps[reps.length - 1];
    const velocityLoss = reps.length >= 2 && fastest > 0 ? Math.max(0, (fastest - last.meanVelocity) / fastest) : null;
    return { reps, x, y, confidence, velocityLoss };
}

/** Fills short runs of lost frames by joining the frames on either side; longer runs become NaN. */
export function bridge(t: number[], values: number[], found: boolean[]): number[] {
    const out = values.slice();
    let i = 0;
    while (i < values.length) {
        if (found[i]) { i++; continue; }
        let j = i;
        while (j < values.length && !found[j]) j++;
        const before = i - 1;
        const after = j;
        const bridgeable = before >= 0 && after < values.length && t[after] - t[before] <= MAX_GAP_MS;
        for (let k = i; k < j; k++) {
            out[k] = bridgeable
                ? values[before] + ((values[after] - values[before]) * (t[k] - t[before])) / (t[after] - t[before])
                : NaN;
        }
        i = j;
    }
    return out;
}

/** Centred moving average over `SMOOTH_MS`, which does not reach across a NaN. */
export function smooth(t: number[], values: number[]): number[] {
    const out = new Array<number>(values.length);
    for (let i = 0; i < values.length; i++) {
        if (Number.isNaN(values[i])) { out[i] = NaN; continue; }
        let sum = values[i], count = 1;
        for (let j = i - 1; j >= 0 && t[i] - t[j] <= SMOOTH_MS / 2 && !Number.isNaN(values[j]); j--) { sum += values[j]; count++; }
        for (let j = i + 1; j < values.length && t[j] - t[i] <= SMOOTH_MS / 2 && !Number.isNaN(values[j]); j++) { sum += values[j]; count++; }
        out[i] = sum / count;
    }
    return out;
}

/** Rate of change per second, across `SLOPE_MS` centred on each frame. */
function derivative(t: number[], values: number[]): number[] {
    return values.map((_, i) => {
        let a = i, b = i;
        while (a > 0 && t[i] - t[a - 1] <= SLOPE_MS / 2) a--;
        while (b < values.length - 1 && t[b + 1] - t[i] <= SLOPE_MS / 2) b++;
        if (a === b) { a = Math.max(0, i - 1); b = Math.min(values.length - 1, i + 1); }
        const dt = (t[b] - t[a]) / 1000;
        return dt > 0 ? (values[b] - values[a]) / dt : 0;
    });
}

/** [start, end] index pairs of the stretches where the bar rises, sticking points included. */
function liftingPhases(t: number[], velocity: number[]): [number, number][] {
    const phases: [number, number][] = [];
    let start = -1;
    let lastMoving = -1;
    for (let i = 0; i < velocity.length; i++) {
        const rising = velocity[i] > MOVING_MPS;
        const broken = Number.isNaN(velocity[i]);
        if (rising) {
            if (start < 0) start = Math.max(0, i - 1);
            lastMoving = i;
        } else if (start >= 0 && (broken || t[i] - t[lastMoving] > STALL_MS)) {
            if (!broken) phases.push([start, lastMoving]);
            start = -1;
        }
    }
    if (start >= 0) phases.push([start, lastMoving]);
    return phases;
}

/**
 * Ends a lifting phase where the bar first reached its top, so settling or
 * creeping up after lockout doesn't stretch the way up.
 */
function toTop(height: number[], start: number, end: number): [number, number] {
    let top = -Infinity;
    for (let i = start; i <= end; i++) top = Math.max(top, height[i]);
    for (let i = start; i <= end; i++) if (height[i] >= top - TOP_TOLERANCE_M) return [start, i];
    return [start, end];
}

/** Joins lifting phases the bar did not sink back between. */
function joinStalls(phases: [number, number][], height: number[]): [number, number][] {
    const joined: [number, number][] = [];
    for (const phase of phases) {
        const previous = joined[joined.length - 1];
        const before = previous ? height[previous[1]] - height[previous[0]] : 0;
        const after = height[phase[1]] - height[phase[0]];
        if (previous && !sankBetween(height, previous[1], phase[0]) && after >= JOIN_MIN_SHARE * before) previous[1] = phase[1];
        else joined.push([phase[0], phase[1]]);
    }
    return joined;
}

function sankBetween(height: number[], from: number, to: number): boolean {
    for (let i = from; i <= to; i++) {
        if (Number.isNaN(height[i]) || height[from] - height[i] > SINK_M) return true;
    }
    return false;
}

/**
 * Where the way down to the bottom at `bottom` began: the last moment the bar
 * was at its top since `from`. Null when there was no way down to speak of,
 * e.g. a deadlift's first rep, which starts from the floor.
 */
function loweringStart(height: number[], from: number, bottom: number, rangeM: number): number | null {
    let top = -Infinity;
    for (let i = from; i < bottom; i++) {
        if (Number.isNaN(height[i])) top = -Infinity; // the way down must be in view throughout
        else top = Math.max(top, height[i]);
    }
    if (!(top - height[bottom] >= MIN_LOWERING_SHARE * rangeM)) return null;
    for (let i = bottom - 1; i >= from; i--) {
        if (Number.isNaN(height[i])) return null;
        if (height[i] >= top - TOP_TOLERANCE_M) return i;
    }
    return null;
}
