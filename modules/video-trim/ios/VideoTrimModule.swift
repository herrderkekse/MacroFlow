import AVFoundation
import ExpoModulesCore

struct TrimResult: Record {
  @Field var uri: String = ""
  @Field var durationMs: Double = 0
}

/// Cuts a video to [startMs, endMs] with a passthrough export: the compressed
/// samples are copied, never re-encoded. Like the Android side, the cut starts
/// at a keyframe, so the clip may begin a fraction of a second early.
///
/// TODO: `cropVideo` (trim and crop, see index.ts) exists on Android only. Until
/// it is added here, `isVideoCropAvailable()` is false on iOS and the crop
/// controls stay hidden.
public class VideoTrimModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoTrim")

    AsyncFunction("trimVideo") { (sourceUri: URL, destUri: URL, startMs: Double, endMs: Double, promise: Promise) in
      guard endMs > startMs else {
        promise.reject("ERR_VIDEO_TRIM", "The end of the range must come after its start")
        return
      }
      let asset = AVURLAsset(url: sourceUri)
      guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else {
        promise.reject("ERR_VIDEO_TRIM", "This video can't be exported")
        return
      }

      // The camera records .mov; most of those pass through into .mp4, but not all.
      var output = destUri
      if session.supportedFileTypes.contains(.mp4) {
        session.outputFileType = .mp4
      } else {
        session.outputFileType = .mov
        output = destUri.deletingPathExtension().appendingPathExtension("mov")
      }
      try? FileManager.default.createDirectory(
        at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
      try? FileManager.default.removeItem(at: output)

      session.outputURL = output
      session.timeRange = CMTimeRange(
        start: CMTime(value: CMTimeValue(startMs), timescale: 1000),
        end: CMTime(value: CMTimeValue(endMs), timescale: 1000))

      session.exportAsynchronously {
        switch session.status {
        case .completed:
          let duration = AVURLAsset(url: output).duration
          var result = TrimResult()
          result.uri = output.absoluteString
          result.durationMs = duration.isNumeric ? CMTimeGetSeconds(duration) * 1000 : endMs - startMs
          promise.resolve(result)
        default:
          try? FileManager.default.removeItem(at: output)
          promise.reject("ERR_VIDEO_TRIM", session.error?.localizedDescription ?? "Trimming failed")
        }
      }
    }
  }
}
