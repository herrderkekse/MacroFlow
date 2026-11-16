import VideoTrimModule, { type TrimResult } from "./src/VideoTrimModule";

export type { TrimResult };

/** Whether this build can trim videos (false on web and on an outdated dev client). */
export function isVideoTrimAvailable(): boolean {
    return VideoTrimModule != null;
}

/**
 * Copies [startMs, endMs] of a local video into a new file at `destUri`,
 * without re-encoding. The cut starts at the keyframe at or before `startMs`.
 * On iOS the file may come out as .mov instead of .mp4 — use the returned uri.
 */
export async function trimVideo(sourceUri: string, destUri: string, startMs: number, endMs: number): Promise<TrimResult> {
    if (!VideoTrimModule) throw new Error("Video trimming is not available in this build");
    return VideoTrimModule.trimVideo(sourceUri, destUri, Math.round(startMs), Math.round(endMs));
}
