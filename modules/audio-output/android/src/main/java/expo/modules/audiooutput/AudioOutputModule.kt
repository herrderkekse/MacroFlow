package expo.modules.audiooutput

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Output device types considered "Bluetooth audio" (the constants are inlined at
// compile time, so referencing the newer ones is safe on older Android versions).
private val BLUETOOTH_OUTPUT_TYPES = intArrayOf(
  AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
  AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
  AudioDeviceInfo.TYPE_BLE_HEADSET,
  AudioDeviceInfo.TYPE_BLE_SPEAKER,
  AudioDeviceInfo.TYPE_HEARING_AID,
)

class AudioOutputModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioOutput")

    AsyncFunction("isBluetoothAudioConnected") {
      val audioManager =
        appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
          ?: return@AsyncFunction false
      audioManager
        .getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        .any { it.type in BLUETOOTH_OUTPUT_TYPES }
    }
  }
}
