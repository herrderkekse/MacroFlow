// The kept range of a video on the trim screen, in milliseconds.

/** The shortest clip the handles allow. */
export const MIN_CLIP_MS = 500;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Where the start handle lands when dragged to `proposedMs`: never past the end, minus the shortest clip. */
export function moveTrimStart(proposedMs: number, endMs: number): number {
    return clamp(proposedMs, 0, Math.max(0, endMs - MIN_CLIP_MS));
}

/** Where the end handle lands when dragged to `proposedMs`: never before the start, plus the shortest clip. */
export function moveTrimEnd(proposedMs: number, startMs: number, durationMs: number): number {
    return clamp(proposedMs, Math.min(durationMs, startMs + MIN_CLIP_MS), durationMs);
}

/** True when the range keeps the whole video, so there is nothing to cut. */
export function isWholeVideo(startMs: number, endMs: number, durationMs: number): boolean {
    return startMs <= 0 && endMs >= durationMs;
}

/** "0:03.2", "12:05.0": minutes, seconds and tenths. */
export function formatClipTime(ms: number): string {
    const tenths = Math.max(0, Math.round(ms / 100));
    const minutes = Math.floor(tenths / 600);
    const seconds = Math.floor((tenths % 600) / 10);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}
