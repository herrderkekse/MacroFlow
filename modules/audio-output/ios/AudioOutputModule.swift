import AVFoundation
import ExpoModulesCore

public class AudioOutputModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AudioOutput")

    AsyncFunction("isBluetoothAudioConnected") { () -> Bool in
      let bluetoothPorts: [AVAudioSession.Port] = [.bluetoothA2DP, .bluetoothLE, .bluetoothHFP]
      return AVAudioSession.sharedInstance().currentRoute.outputs.contains {
        bluetoothPorts.contains($0.portType)
      }
    }
  }
}
