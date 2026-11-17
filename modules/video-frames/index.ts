import VideoFramesModule, { type FramesResult } from "./src/VideoFramesModule";

export type { FramesResult };

/**
 * Layout of the frames file, little-endian throughout:
 *
 *     header:  int32 width, int32 height          (FRAMES_HEADER_BYTES)
 *     frame:   float64 time in ms                 (FRAME_TIME_BYTES)
 *              width × height bytes, row by row   (one per pixel, 0–255)
 *     frame:   …
 *
 * The file is written while the video is decoded, a whole frame at a time,
 * so it can be read while it grows: every complete frame record in it is final.
 */
export const FRAMES_HEADER_BYTES = 8;
export const FRAME_TIME_BYTES = 8;

/** Whether this build can read video frames (false on web and on an outdated dev client). */
export function isVideoFramesAvailable(): boolean {
    return VideoFramesModule != null;
}

/**
 * Decodes a local video into small grayscale frames, written to `destUri` as
 * they are decoded (layout above), upright as the video is shown. The longer
 * side is at most `maxSide`; at most `maxFps` frames per second and
 * `maxFrames` frames in all are kept. Resolves once the whole video is done.
 */
export async function extractGrayFrames(
    sourceUri: string, destUri: string, options: { maxSide: number; maxFps: number; maxFrames: number },
): Promise<FramesResult> {
    if (!VideoFramesModule) throw new Error("Reading video frames is not available in this build");
    const { maxSide, maxFps, maxFrames } = options;
    return VideoFramesModule.extractGrayFrames(sourceUri, destUri, Math.round(maxSide), maxFps, Math.round(maxFrames));
}
