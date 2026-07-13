import AudioOutputModule from "./src/AudioOutputModule";

/**
 * True when a Bluetooth audio output (earphones, speaker, hearing aid) is
 * currently connected. Safe everywhere: resolves false on web or when the
 * native module isn't part of the current build.
 */
export async function isBluetoothAudioConnected(): Promise<boolean> {
    if (!AudioOutputModule) return false;
    try {
        return await AudioOutputModule.isBluetoothAudioConnected();
    } catch {
        return false;
    }
}
