import { NativeModule, requireOptionalNativeModule } from "expo";

export interface TrimResult {
    uri: string;
    durationMs: number;
}

/** The part of the picture to keep, as shares of its width and height from its top left, upright. */
export interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

declare class VideoTrimModule extends NativeModule<Record<never, never>> {
    trimVideo(sourceUri: string, destUri: string, startMs: number, endMs: number): Promise<TrimResult>;
    /** Android only so far; absent on iOS and on builds from before it. */
    cropVideo?(sourceUri: string, destUri: string, startMs: number, endMs: number, rect: CropRect): Promise<TrimResult>;
}

// null when the native module isn't part of the current build (e.g. an outdated dev client)
export default requireOptionalNativeModule<VideoTrimModule>("VideoTrim");
