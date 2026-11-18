import { NativeModule, requireOptionalNativeModule } from "expo";

export interface FramesResult {
    /** The file the frames were written to. */
    uri: string;
    /** Size of each frame, upright. */
    width: number;
    height: number;
    /** When each frame was taken in the video, in milliseconds. */
    timesMs: number[];
}

declare class VideoFramesModule extends NativeModule<Record<never, never>> {
    extractGrayFrames(sourceUri: string, destUri: string, maxSide: number, maxFps: number, maxFrames: number): Promise<FramesResult>;
}

// null when the native module isn't part of the current build (e.g. an outdated dev client)
export default requireOptionalNativeModule<VideoFramesModule>("VideoFrames");
