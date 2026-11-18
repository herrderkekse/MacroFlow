import VideoTrimModule, { type CropRect, type TrimResult } from "./src/VideoTrimModule";

export type { CropRect, TrimResult };

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

/**
 * Whether this build can crop videos. Android only for now.
 * TODO(iOS): implement `cropVideo` in ios/VideoTrimModule.swift (an
 * AVAssetExportSession with an AVMutableVideoComposition whose render size is
 * the crop and whose layer instruction moves it into place, honouring the
 * track's preferredTransform); this then turns true on its own.
 */
export function isVideoCropAvailable(): boolean {
    return typeof VideoTrimModule?.cropVideo === "function";
}

/**
 * Copies [startMs, endMs] of a local video into a new file at `destUri`,
 * keeping only `rect` of its picture. Re-encodes the video, so it takes a
 * while for a long one; the cut lands on the exact frame.
 */
export async function cropVideo(sourceUri: string, destUri: string, startMs: number, endMs: number, rect: CropRect): Promise<TrimResult> {
    if (!VideoTrimModule?.cropVideo) throw new Error("Video cropping is not available in this build");
    return VideoTrimModule.cropVideo(sourceUri, destUri, Math.round(startMs), Math.round(endMs), rect);
}
