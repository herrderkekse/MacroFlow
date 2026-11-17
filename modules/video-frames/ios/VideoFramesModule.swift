import AVFoundation
import CoreVideo
import ExpoModulesCore

struct FramesResult: Record {
  @Field var uri: String = ""
  @Field var width: Int = 0
  @Field var height: Int = 0
  @Field var timesMs: [Double] = []
}

/// Decodes a video into small grayscale frames for image analysis: the
/// brightness (Y) plane of each frame, shrunk so its longer side is at most
/// maxSide and turned upright as the video is shown. At most maxFps frames per
/// second and maxFrames frames in all are kept.
///
/// They are written to destUri as they are decoded, so the file can be read
/// while it grows (see modules/video-frames/index.ts for the layout): a header
/// with the frame size, then per frame its time and its pixels, row by row,
/// one byte per pixel.
public class VideoFramesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoFrames")

    AsyncFunction("extractGrayFrames") { (sourceUri: URL, destUri: URL, maxSide: Int, maxFps: Double, maxFrames: Int) throws -> FramesResult in
      guard maxSide >= 8, maxFps > 0, maxFrames > 0 else {
        throw Exception(name: "ERR_VIDEO_FRAMES", description: "Invalid limits")
      }
      do {
        return try extract(source: sourceUri, dest: destUri, maxSide: maxSide, maxFps: maxFps, maxFrames: maxFrames)
      } catch {
        try? FileManager.default.removeItem(at: destUri)
        throw Exception(name: "ERR_VIDEO_FRAMES", description: error.localizedDescription)
      }
    }
  }
}

private struct FramesError: LocalizedError {
  let errorDescription: String?
  init(_ message: String) { errorDescription = message }
}

private func extract(source: URL, dest: URL, maxSide: Int, maxFps: Double, maxFrames: Int) throws -> FramesResult {
  let asset = AVURLAsset(url: source)
  guard let track = asset.tracks(withMediaType: .video).first else { throw FramesError("The video has no video track") }
  let reader = try AVAssetReader(asset: asset)
  let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange,
  ])
  output.alwaysCopiesSampleData = false
  reader.add(output)
  guard reader.startReading() else { throw reader.error ?? FramesError("The video can't be read") }

  try FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
  FileManager.default.createFile(atPath: dest.path, contents: nil)
  let handle = try FileHandle(forWritingTo: dest)
  defer { try? handle.close() }

  let turns = quarterTurns(track.preferredTransform)
  let stepMs = 1000.0 / maxFps
  var nextMs = -Double.infinity
  var times: [Double] = []
  var shrinker: Shrinker?

  while times.count < maxFrames, let sample = output.copyNextSampleBuffer() {
    let timeMs = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample)) * 1000
    // Keep a frame once a step has passed since the last one kept (a quarter step early is fine).
    guard timeMs >= nextMs - stepMs / 4, let pixels = CMSampleBufferGetImageBuffer(sample) else { continue }
    let s: Shrinker
    if let existing = shrinker {
      s = existing
    } else {
      s = Shrinker(
        srcWidth: CVPixelBufferGetWidthOfPlane(pixels, 0), srcHeight: CVPixelBufferGetHeightOfPlane(pixels, 0),
        turns: turns, maxSide: maxSide)
      shrinker = s
      handle.write(littleEndian(Int32(s.outWidth)) + littleEndian(Int32(s.outHeight)))
    }
    let frame = s.shrink(pixels)
    handle.write(littleEndian(timeMs) + frame)
    times.append(timeMs)
    nextMs = timeMs + stepMs
  }
  reader.cancelReading()

  guard let s = shrinker else { throw FramesError("The video has no frames") }
  var result = FramesResult()
  result.uri = dest.absoluteString
  result.width = s.outWidth
  result.height = s.outHeight
  result.timesMs = times
  return result
}

private func littleEndian(_ value: Int32) -> Data {
  withUnsafeBytes(of: value.littleEndian) { Data($0) }
}

private func littleEndian(_ value: Double) -> Data {
  withUnsafeBytes(of: value.bitPattern.littleEndian) { Data($0) }
}

/// How many quarter turns clockwise the video is shown turned by.
private func quarterTurns(_ t: CGAffineTransform) -> Int {
  let degrees = atan2(Double(t.b), Double(t.a)) * 180 / .pi
  return ((Int((degrees / 90).rounded()) % 4) + 4) % 4
}

/// Shrinks the Y plane of frames of one size by averaging blocks of pixels,
/// then turns the result upright.
private final class Shrinker {
  let srcWidth: Int
  let srcHeight: Int
  let turns: Int
  let width: Int
  let height: Int
  let outWidth: Int
  let outHeight: Int

  init(srcWidth: Int, srcHeight: Int, turns: Int, maxSide: Int) {
    self.srcWidth = srcWidth
    self.srcHeight = srcHeight
    self.turns = turns
    let scale = min(1, Double(maxSide) / Double(max(srcWidth, srcHeight)))
    width = max(1, Int((Double(srcWidth) * scale).rounded()))
    height = max(1, Int((Double(srcHeight) * scale).rounded()))
    outWidth = turns % 2 == 1 ? height : width
    outHeight = turns % 2 == 1 ? width : height
  }

  func shrink(_ pixels: CVPixelBuffer) -> Data {
    CVPixelBufferLockBaseAddress(pixels, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixels, .readOnly) }
    var small = [UInt8](repeating: 0, count: width * height)
    guard let base = CVPixelBufferGetBaseAddressOfPlane(pixels, 0) else { return Data(small) }
    let data = base.assumingMemoryBound(to: UInt8.self)
    let rowStride = CVPixelBufferGetBytesPerRowOfPlane(pixels, 0)

    // Up to 4×4 samples per block are enough to average away aliasing.
    for y in 0..<height {
      let sy0 = (y * srcHeight) / height
      let sy1 = max(sy0 + 1, ((y + 1) * srcHeight) / height)
      let stepY = max(1, (sy1 - sy0) / 4)
      for x in 0..<width {
        let sx0 = (x * srcWidth) / width
        let sx1 = max(sx0 + 1, ((x + 1) * srcWidth) / width)
        let stepX = max(1, (sx1 - sx0) / 4)
        var sum = 0
        var count = 0
        var sy = sy0
        while sy < sy1 {
          let row = sy * rowStride
          var sx = sx0
          while sx < sx1 {
            sum += Int(data[row + sx])
            count += 1
            sx += stepX
          }
          sy += stepY
        }
        small[y * width + x] = UInt8(sum / count)
      }
    }
    if turns == 0 { return Data(small) }

    var upright = [UInt8](repeating: 0, count: width * height)
    for dy in 0..<outHeight {
      for dx in 0..<outWidth {
        let src: Int
        switch turns {
        case 1: src = (height - 1 - dx) * width + dy // turned a quarter clockwise
        case 2: src = (height - 1 - dy) * width + (width - 1 - dx)
        default: src = dx * width + (width - 1 - dy)
        }
        upright[dy * outWidth + dx] = small[src]
      }
    }
    return Data(upright)
  }
}
