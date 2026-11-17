package expo.modules.videoframes

import android.graphics.ImageFormat
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream

private const val TIMEOUT_US = 10_000L

class FramesResult : Record {
  @Field var uri: String = ""
  @Field var width: Int = 0
  @Field var height: Int = 0
  @Field var timesMs: List<Double> = emptyList()
}

private class FramesFailedException(message: String, cause: Throwable? = null) :
  CodedException("ERR_VIDEO_FRAMES", message, cause)

/**
 * Decodes a video into small grayscale frames for image analysis: the
 * brightness (Y) plane of each decoded frame, shrunk so its longer side is at
 * most maxSide and turned upright as the video is shown. The frames are
 * written one after the other, row by row, one byte per pixel, to destUri.
 * At most maxFps frames per second and maxFrames frames in all are kept.
 */
class VideoFramesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoFrames")

    AsyncFunction("extractGrayFrames") { sourceUri: String, destUri: String, maxSide: Int, maxFps: Double, maxFrames: Int ->
      val context = appContext.reactContext ?: throw FramesFailedException("No React context")
      if (maxSide < 8 || maxFps <= 0 || maxFrames <= 0) throw FramesFailedException("Invalid limits")
      val destFile = File(Uri.parse(destUri).path ?: throw FramesFailedException("Invalid destination: $destUri"))
      try {
        extract(context, Uri.parse(sourceUri), destFile, maxSide, maxFps, maxFrames)
      } catch (e: CodedException) {
        destFile.delete()
        throw e
      } catch (e: Exception) {
        destFile.delete()
        throw FramesFailedException(e.message ?: "Reading the video failed", e)
      }
    }
  }

  private fun extract(
    context: android.content.Context, source: Uri, dest: File, maxSide: Int, maxFps: Double, maxFrames: Int,
  ): FramesResult {
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    dest.parentFile?.mkdirs()
    val out = BufferedOutputStream(FileOutputStream(dest), 1 shl 16)
    try {
      extractor.setDataSource(context, source, null)
      val track = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
      } ?: throw FramesFailedException("The video has no video track")
      extractor.selectTrack(track)
      val format = extractor.getTrackFormat(track)
      val mime = format.getString(MediaFormat.KEY_MIME)!!
      val rotation = if (format.containsKey(MediaFormat.KEY_ROTATION)) {
        format.getInteger(MediaFormat.KEY_ROTATION)
      } else {
        readRotation(context, source)
      }

      // Ask for YUV in memory rather than drawing to a surface, so the Y plane can be read.
      format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
      codec = MediaCodec.createDecoderByType(mime)
      codec.configure(format, null, null, 0)
      codec.start()

      val stepUs = (1_000_000.0 / maxFps).toLong()
      // When the next frame is due; the first one always is. (Not Long.MIN_VALUE: the check below subtracts from it.)
      var nextUs = 0L
      var first = true
      val times = ArrayList<Double>()
      var shrinker: Shrinker? = null
      val info = MediaCodec.BufferInfo()
      var inputDone = false

      while (times.size < maxFrames) {
        if (!inputDone) {
          val inIndex = codec.dequeueInputBuffer(TIMEOUT_US)
          if (inIndex >= 0) {
            val buffer = codec.getInputBuffer(inIndex)!!
            val size = extractor.readSampleData(buffer, 0)
            if (size < 0) {
              codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              codec.queueInputBuffer(inIndex, 0, size, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        val outIndex = codec.dequeueOutputBuffer(info, TIMEOUT_US)
        if (outIndex < 0) continue
        val ended = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
        val timeUs = info.presentationTimeUs
        // Keep a frame once a step has passed since the last one kept (a quarter step early is fine,
        // so 60 fps footage halves evenly to 30).
        if (info.size > 0 && (first || timeUs >= nextUs - stepUs / 4)) {
          val image = codec.getOutputImage(outIndex)
          if (image != null) {
            try {
              val s = shrinker ?: Shrinker(image.cropRect.width(), image.cropRect.height(), rotation, maxSide).also { shrinker = it }
              out.write(s.shrink(image))
              times.add(timeUs / 1000.0)
              nextUs = timeUs + stepUs
              first = false
            } finally {
              image.close()
            }
          }
        }
        codec.releaseOutputBuffer(outIndex, false)
        if (ended) break
      }

      out.flush()
      val s = shrinker ?: throw FramesFailedException("The video has no frames")
      return FramesResult().apply {
        uri = Uri.fromFile(dest).toString()
        width = s.outWidth
        height = s.outHeight
        timesMs = times
      }
    } finally {
      try { out.close() } catch (_: Exception) { }
      try { codec?.stop() } catch (_: Exception) { }
      try { codec?.release() } catch (_: Exception) { }
      extractor.release()
    }
  }

  private fun readRotation(context: android.content.Context, source: Uri): Int {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(context, source)
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
    } catch (_: Exception) {
      0
    } finally {
      retriever.release()
    }
  }
}

/**
 * Shrinks the Y plane of decoded frames of one size by averaging blocks of
 * pixels, then turns the result upright by the video's rotation.
 */
private class Shrinker(val srcWidth: Int, val srcHeight: Int, rotation: Int, maxSide: Int) {
  private val turns = ((rotation % 360 + 360) % 360) / 90
  private val scale = minOf(1.0, maxSide.toDouble() / maxOf(srcWidth, srcHeight))
  // Size before turning upright.
  private val width = maxOf(1, Math.round(srcWidth * scale).toInt())
  private val height = maxOf(1, Math.round(srcHeight * scale).toInt())
  val outWidth = if (turns % 2 == 1) height else width
  val outHeight = if (turns % 2 == 1) width else height
  private val small = ByteArray(width * height)
  private val upright = ByteArray(width * height)

  fun shrink(image: Image): ByteArray {
    if (image.format != ImageFormat.YUV_420_888) throw IllegalStateException("Unexpected frame format ${image.format}")
    val plane = image.planes[0]
    val data = plane.buffer
    val rowStride = plane.rowStride
    val pixelStride = plane.pixelStride
    val crop = image.cropRect
    // Up to 4×4 samples per block are enough to average away aliasing.
    for (y in 0 until height) {
      val sy0 = crop.top + (y * srcHeight) / height
      val sy1 = maxOf(sy0 + 1, crop.top + ((y + 1) * srcHeight) / height)
      val stepY = maxOf(1, (sy1 - sy0) / 4)
      for (x in 0 until width) {
        val sx0 = crop.left + (x * srcWidth) / width
        val sx1 = maxOf(sx0 + 1, crop.left + ((x + 1) * srcWidth) / width)
        val stepX = maxOf(1, (sx1 - sx0) / 4)
        var sum = 0
        var count = 0
        var sy = sy0
        while (sy < sy1) {
          val row = sy * rowStride
          var sx = sx0
          while (sx < sx1) {
            sum += data.get(row + sx * pixelStride).toInt() and 0xFF
            count++
            sx += stepX
          }
          sy += stepY
        }
        small[y * width + x] = (sum / count).toByte()
      }
    }
    if (turns == 0) return small
    for (dy in 0 until outHeight) {
      for (dx in 0 until outWidth) {
        val src = when (turns) {
          1 -> (height - 1 - dx) * width + dy // turned a quarter clockwise
          2 -> (height - 1 - dy) * width + (width - 1 - dx)
          else -> dx * width + (width - 1 - dy)
        }
        upright[dy * outWidth + dx] = small[src]
      }
    }
    return upright
  }
}
