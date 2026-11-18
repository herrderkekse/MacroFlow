// Stepping through a video one frame at a time, by seeking. The player has no
// "next frame" of its own, and the two platforms land on different frames for
// the same exact seek:
// - Android (ExoPlayer) shows the first frame at or after the time asked for;
// - iOS (AVPlayer) shows the frame on screen at that time: the last one at or before it.
// So each one is sent half a frame to the side the frame lies on, which also
// absorbs the jitter of a phone's frame times.

/** Frame rate to assume when the video doesn't say. */
export const FALLBACK_FPS = 30;

export type SeekRule = "atOrAfter" | "atOrBefore";

/** The frame showing at `ms`, counting from 0. */
export function frameIndexAt(ms: number, frameMs: number): number {
    return Math.max(0, Math.floor(ms / frameMs + 0.5));
}

/** Where to seek to show frame `index`. */
export function frameSeekMs(index: number, frameMs: number, rule: SeekRule): number {
    const ms = rule === "atOrAfter" ? (index - 0.5) * frameMs + 1 : (index + 0.5) * frameMs - 1;
    return Math.max(0, ms);
}

interface StepInput {
    currentMs: number;
    /** +1 for the next frame, -1 for the previous one. */
    direction: 1 | -1;
    fps: number | null | undefined;
    durationMs: number;
    rule: SeekRule;
}

/** Where to seek for the frame next to the one showing at `currentMs`, inside the video. */
export function stepFrameMs({ currentMs, direction, fps, durationMs, rule }: StepInput): number {
    const frameMs = 1000 / (fps && fps > 0 ? fps : FALLBACK_FPS);
    // Frames start every frameMs from 0, the last one before the end.
    const lastIndex = Math.max(0, Math.ceil(durationMs / frameMs - 1e-6) - 1);
    const index = Math.min(Math.max(frameIndexAt(currentMs, frameMs) + direction, 0), lastIndex);
    return Math.min(frameSeekMs(index, frameMs, rule), durationMs);
}
