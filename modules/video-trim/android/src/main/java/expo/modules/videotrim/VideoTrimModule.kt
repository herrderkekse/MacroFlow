package expo.modules.videotrim

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.nio.ByteBuffer

// Big enough for a 4K keyframe; grown on demand when a sample is larger.
private const val DEFAULT_BUFFER_BYTES = 4 * 1024 * 1024

class TrimResult : Record {
  @Field var uri: String = ""
  @Field var durationMs: Double = 0.0
}

private class TrimFailedException(message: String, cause: Throwable? = null) :
  CodedException("ERR_VIDEO_TRIM", message, cause)

/**
 * Cuts a video to [startMs, endMs] by copying its compressed samples into a new
 * MP4 — no decoding or re-encoding, so it is fast and lossless. The cut starts
 * at the last keyframe at or before startMs (a file can't start mid-GOP without
 * re-encoding), so the clip may begin a fraction of a second early.
 */
class VideoTrimModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoTrim")

    AsyncFunction("trimVideo") { sourceUri: String, destUri: String, startMs: Double, endMs: Double ->
      val context = appContext.reactContext ?: throw TrimFailedException("No React context")
      if (endMs <= startMs) throw TrimFailedException("The end of the range must come after its start")
      val destFile = File(Uri.parse(destUri).path ?: throw TrimFailedException("Invalid destination: $destUri"))
      try {
        trim(context, Uri.parse(sourceUri), destFile, (startMs * 1000).toLong(), (endMs * 1000).toLong())
      } catch (e: CodedException) {
        destFile.delete()
        throw e
      } catch (e: Exception) {
        destFile.delete()
        throw TrimFailedException(e.message ?: "Trimming failed", e)
      }
    }

    AsyncFunction("cropVideo") { sourceUri: String, destUri: String, startMs: Double, endMs: Double, rect: CropRect, promise: Promise ->
      val context = appContext.reactContext ?: throw TrimFailedException("No React context")
      if (endMs <= startMs) throw TrimFailedException("The end of the range must come after its start")
      if (rect.width <= 0 || rect.height <= 0) throw TrimFailedException("The crop is empty")
      val destFile = File(Uri.parse(destUri).path ?: throw TrimFailedException("Invalid destination: $destUri"))
      VideoCropper.crop(
        context, Uri.parse(sourceUri), destFile, startMs.toLong(), endMs.toLong(), rect,
        onDone = { promise.resolve(it) },
        onError = { promise.reject(TrimFailedException(it.message ?: "Cropping failed", it)) },
      )
    }
  }

  private fun trim(context: android.content.Context, source: Uri, dest: File, startUs: Long, endUs: Long): TrimResult {
    val extractor = MediaExtractor()
    var muxer: MediaMuxer? = null
    try {
      extractor.setDataSource(context, source, null)

      dest.parentFile?.mkdirs()
      muxer = MediaMuxer(dest.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer.setOrientationHint(readRotation(context, source))

      // Source track index → muxer track index, for the audio and video tracks only.
      val trackMap = HashMap<Int, Int>()
      var bufferSize = DEFAULT_BUFFER_BYTES
      for (i in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        if (!mime.startsWith("video/") && !mime.startsWith("audio/")) continue
        extractor.selectTrack(i)
        trackMap[i] = muxer.addTrack(format)
        if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
          bufferSize = maxOf(bufferSize, format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE))
        }
      }
      if (trackMap.isEmpty()) throw TrimFailedException("The video has no audio or video track")

      // Each track seeks on its own, and every audio sample is a sync sample, so
      // a plain seek would start the sound at startUs but the picture at the
      // keyframe before it. Find that keyframe with only the video selected,
      // then start every track there.
      val videoTrack = trackMap.keys.firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
      }
      var baseUs = startUs
      if (videoTrack != null) {
        trackMap.keys.filter { it != videoTrack }.forEach { extractor.unselectTrack(it) }
        extractor.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
        if (extractor.sampleTime >= 0) baseUs = extractor.sampleTime
        trackMap.keys.filter { it != videoTrack }.forEach { extractor.selectTrack(it) }
      }
      extractor.seekTo(baseUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)

      var buffer = ByteBuffer.allocateDirect(bufferSize)
      val info = MediaCodec.BufferInfo()
      var written = 0
      var lastUs = 0L
      muxer.start()

      while (true) {
        val track = extractor.sampleTrackIndex
        if (track < 0) break
        val timeUs = extractor.sampleTime
        if (timeUs > endUs) {
          // Samples are interleaved, so one track passing the end doesn't end the others.
          extractor.unselectTrack(track)
          continue
        }
        val muxTrack = trackMap[track]
        if (muxTrack == null) { extractor.advance(); continue }
        if (timeUs < baseUs) { extractor.advance(); continue } // audio from before the keyframe

        // Older Androids can't report a sample's size; the buffer sized from the formats has to do.
        val sampleSize = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) extractor.sampleSize else -1L
        if (sampleSize > buffer.capacity()) buffer = ByteBuffer.allocateDirect(sampleSize.toInt())
        buffer.clear()
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) break

        info.offset = 0
        info.size = size
        info.presentationTimeUs = timeUs - baseUs
        info.flags = if ((extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0) {
          MediaCodec.BUFFER_FLAG_KEY_FRAME
        } else 0
        muxer.writeSampleData(muxTrack, buffer, info)
        lastUs = maxOf(lastUs, info.presentationTimeUs)
        written++
        extractor.advance()
      }

      if (written == 0) throw TrimFailedException("The range contains no frames")
      muxer.stop()

      return TrimResult().apply {
        uri = Uri.fromFile(dest).toString()
        durationMs = lastUs / 1000.0
      }
    } finally {
      try { muxer?.release() } catch (_: Exception) { }
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
