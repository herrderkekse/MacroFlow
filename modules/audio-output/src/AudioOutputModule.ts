import { NativeModule, requireOptionalNativeModule } from "expo";

declare class AudioOutputModule extends NativeModule<Record<never, never>> {
    isBluetoothAudioConnected(): Promise<boolean>;
}

// null when the native module isn't part of the current build (e.g. an outdated dev client)
export default requireOptionalNativeModule<AudioOutputModule>("AudioOutput");
