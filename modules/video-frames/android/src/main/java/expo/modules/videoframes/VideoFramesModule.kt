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
import java.nio.ByteBuffer
import java.nio.ByteOrder

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
 * most maxSide and turned upright as the video is shown. At most maxFps
 * frames per second and maxFrames frames in all are kept.
 *
 * They are written to destUri as they are decoded, so the file can be read
 * while it grows (see modules/video-frames/index.ts for the layout): a header
 * with the frame size, then per frame its time and its pixels, row by row,
 * one byte per pixel. Each frame is flushed whole before the next begins.
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
      // As fast as it can, not at playback speed. Some decoders refuse an
      // operating rate; they get the plain format instead.
      try {
        format.setInteger(MediaFormat.KEY_PRIORITY, 1)
        format.setInteger(MediaFormat.KEY_OPERATING_RATE, Short.MAX_VALUE.toInt())
        codec.configure(format, null, null, 0)
      } catch (_: Exception) {
        codec.release()
        codec = MediaCodec.createDecoderByType(mime)
        format.removeKey(MediaFormat.KEY_PRIORITY)
        format.removeKey(MediaFormat.KEY_OPERATING_RATE)
        codec.configure(format, null, null, 0)
      }
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
        // Hand the decoder every sample it has room for, so its pipeline never runs dry.
        while (!inputDone) {
          val inIndex = codec.dequeueInputBuffer(0)
          if (inIndex < 0) break
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
              val s = shrinker ?: Shrinker(image.cropRect.width(), image.cropRect.height(), rotation, maxSide).also {
                shrinker = it
                out.write(littleEndian(8) { putInt(it.outWidth); putInt(it.outHeight) })
              }
              val pixels = s.shrink(image)
              out.write(littleEndian(8) { putDouble(timeUs / 1000.0) })
              out.write(pixels)
              out.flush()
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

private fun littleEndian(size: Int, fill: ByteBuffer.() -> Unit): ByteArray =
  ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN).apply(fill).array()

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

  // The plane, copied out of the decoder's buffer in one go: reading a direct
  // ByteBuffer byte by byte is what made shrinking slow.
  private var plane = ByteArray(0)
  // Where each output pixel's samples lie: two columns and two rows per block,
  // at a quarter and three quarters of it, which is enough to average away
  // aliasing. Worked out on the first frame; every frame of a video is laid out alike.
  private var columns = IntArray(0)
  private var rows = IntArray(0)

  fun shrink(image: Image): ByteArray {
    if (image.format != ImageFormat.YUV_420_888) throw IllegalStateException("Unexpected frame format ${image.format}")
    val y = image.planes[0]
    val buffer = y.buffer
    buffer.rewind()
    val size = buffer.remaining()
    if (plane.size < size) plane = ByteArray(size)
    buffer.get(plane, 0, size)
    if (columns.isEmpty()) layOut(image.cropRect.left, image.cropRect.top, y.rowStride, y.pixelStride)

    val data = plane
    for (oy in 0 until height) {
      val row0 = rows[oy * 2]
      val row1 = rows[oy * 2 + 1]
      for (ox in 0 until width) {
        val c0 = columns[ox * 2]
        val c1 = columns[ox * 2 + 1]
        val sum = (data[row0 + c0].toInt() and 0xFF) + (data[row0 + c1].toInt() and 0xFF) +
          (data[row1 + c0].toInt() and 0xFF) + (data[row1 + c1].toInt() and 0xFF)
        small[oy * width + ox] = ((sum + 2) shr 2).toByte()
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

  private fun layOut(left: Int, top: Int, rowStride: Int, pixelStride: Int) {
    columns = IntArray(width * 2) { i ->
      val x = i / 2
      val at = left + (((x * 4 + 1 + (i % 2) * 2) * srcWidth) / (width * 4)).coerceAtMost(srcWidth - 1)
      at * pixelStride
    }
    rows = IntArray(height * 2) { i ->
      val y = i / 2
      (top + (((y * 4 + 1 + (i % 2) * 2) * srcHeight) / (height * 4)).coerceAtMost(srcHeight - 1)) * rowStride
    }
  }
}
