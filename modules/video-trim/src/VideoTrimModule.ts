import { NativeModule, requireOptionalNativeModule } from "expo";

export interface TrimResult {
    uri: string;
    durationMs: number;
}

declare class VideoTrimModule extends NativeModule<Record<never, never>> {
    trimVideo(sourceUri: string, destUri: string, startMs: number, endMs: number): Promise<TrimResult>;
}

// null when the native module isn't part of the current build (e.g. an outdated dev client)
export default requireOptionalNativeModule<VideoTrimModule>("VideoTrim");
