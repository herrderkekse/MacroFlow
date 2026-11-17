import VideoFramesModule, { type FramesResult } from "./src/VideoFramesModule";

export type { FramesResult };

/** Whether this build can read video frames (false on web and on an outdated dev client). */
export function isVideoFramesAvailable(): boolean {
    return VideoFramesModule != null;
}

/**
 * Decodes a local video into small grayscale frames, written one after the
 * other to `destUri`: `width × height` bytes each, one per pixel, row by row,
 * upright as the video is shown. The longer side is at most `maxSide`; at
 * most `maxFps` frames per second and `maxFrames` frames in all are kept.
 */
export async function extractGrayFrames(
    sourceUri: string, destUri: string, options: { maxSide: number; maxFps: number; maxFrames: number },
): Promise<FramesResult> {
    if (!VideoFramesModule) throw new Error("Reading video frames is not available in this build");
    const { maxSide, maxFps, maxFrames } = options;
    return VideoFramesModule.extractGrayFrames(sourceUri, destUri, Math.round(maxSide), maxFps, Math.round(maxFrames));
}
