package expo.modules.videotrim

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Crop
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File

/** The part of the picture to keep, as shares of its width and height, measured from its top left as it is shown (upright). */
class CropRect : Record {
  @Field var x: Double = 0.0
  @Field var y: Double = 0.0
  @Field var width: Double = 1.0
  @Field var height: Double = 1.0
}

/**
 * Cuts a video to [startMs, endMs] and crops its picture, with Media3's
 * Transformer. Unlike trimming alone this decodes and re-encodes the video,
 * so it takes about as long as the video plays (less on fast phones), and the
 * cut lands on the exact frame instead of a keyframe.
 */
@OptIn(UnstableApi::class)
internal object VideoCropper {
  fun crop(
    context: Context,
    source: Uri,
    dest: File,
    startMs: Long,
    endMs: Long,
    rect: CropRect,
    onDone: (TrimResult) -> Unit,
    onError: (Exception) -> Unit,
  ) {
    dest.parentFile?.mkdirs()
    dest.delete()

    val clipping = MediaItem.ClippingConfiguration.Builder()
      .setStartPositionMs(startMs)
      .setEndPositionMs(endMs)
      .build()
    val item = MediaItem.Builder().setUri(source).setClippingConfiguration(clipping).build()

    // Media3 applies the video's rotation before its effects, so the crop is in
    // the upright picture; it takes normalized device coordinates (-1 to 1, y up).
    val left = (2 * rect.x - 1).toFloat()
    val right = (2 * (rect.x + rect.width) - 1).toFloat()
    val top = (1 - 2 * rect.y).toFloat()
    val bottom = (1 - 2 * (rect.y + rect.height)).toFloat()
    val effects = Effects(emptyList(), listOf(Crop(left, right, bottom, top)))
    val edited = EditedMediaItem.Builder(item).setEffects(effects).build()

    // Transformer runs on, and calls back on, the thread it is created on, which needs a Looper.
    Handler(Looper.getMainLooper()).post {
      val transformer = Transformer.Builder(context)
        .setVideoMimeType(MimeTypes.VIDEO_H264)
        .addListener(object : Transformer.Listener {
          override fun onCompleted(composition: Composition, exportResult: ExportResult) {
            onDone(TrimResult().apply {
              uri = Uri.fromFile(dest).toString()
              durationMs = exportResult.durationMs.toDouble()
            })
          }

          override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
            dest.delete()
            onError(exportException)
          }
        })
        .build()
      try {
        transformer.start(edited, dest.path)
      } catch (e: Exception) {
        dest.delete()
        onError(e)
      }
    }
  }
}
