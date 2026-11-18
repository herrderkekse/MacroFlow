import { cropVideo, isVideoCropAvailable, isVideoTrimAvailable, trimVideo, type CropRect } from "@/modules/video-trim";
import { Directory, File, Paths } from "expo-file-system";
import { isWholeVideo } from "../helpers/trimRange";
import {
    deleteSetVideoRow, getSetUuid, getSetVideo, listSetUuids, listSetVideos, putSetVideo, type SetVideo,
} from "./setVideoDb";

// Set videos live in the document directory, which the OS never clears, unlike
// the cache where the camera and the picker leave their files. They are not
// part of backups or sync; only the `set_videos` rows travel with a backup.
const DIR_NAME = "set-videos";

function videoDir(): Directory {
    return new Directory(Paths.document, DIR_NAME);
}

export function setVideoUri(video: SetVideo): string {
    return new File(videoDir(), video.file_name).uri;
}

export { isVideoCropAvailable, isVideoTrimAvailable };

interface SaveSetVideoInput {
    setUuid: string;
    sourceUri: string;
    /** The kept range; a range covering the whole video copies it as it is. */
    startMs: number;
    endMs: number;
    sourceDurationMs: number;
    /** The part of the picture to keep; null keeps all of it. */
    crop?: CropRect | null;
}

/**
 * Stores a video for a set: cuts it to the range and crops it (re-encoding
 * it), cuts it without re-encoding, or copies it whole, as needed; points
 * the set at the new file and removes the file it replaces. A source the camera
 * or the picker left in the cache is deleted once it has been stored.
 */
export async function saveSetVideo({ setUuid, sourceUri, startMs, endMs, sourceDurationMs, crop }: SaveSetVideoInput): Promise<void> {
    const dir = videoDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

    const stamp = Date.now();
    let fileName: string;
    let durationMs: number;

    if (crop && isVideoCropAvailable()) {
        const result = await cropVideo(sourceUri, new File(dir, `${setUuid}-${stamp}.mp4`).uri, startMs, endMs, crop);
        fileName = result.uri.split("/").pop() ?? `${setUuid}-${stamp}.mp4`;
        durationMs = Math.round(result.durationMs);
    } else if (!isWholeVideo(startMs, endMs, sourceDurationMs) && isVideoTrimAvailable()) {
        const result = await trimVideo(sourceUri, new File(dir, `${setUuid}-${stamp}.mp4`).uri, startMs, endMs);
        fileName = result.uri.split("/").pop() ?? `${setUuid}-${stamp}.mp4`;
        durationMs = Math.round(result.durationMs);
    } else {
        const extension = sourceUri.match(/\.(\w+)$/)?.[1]?.toLowerCase() ?? "mp4";
        fileName = `${setUuid}-${stamp}.${extension}`;
        new File(sourceUri).copy(new File(dir, fileName));
        durationMs = Math.round(sourceDurationMs);
    }

    const previous = getSetVideo(setUuid);
    putSetVideo(setUuid, fileName, durationMs);
    if (previous && previous.file_name !== fileName) deleteQuietly(new File(dir, previous.file_name));
    if (sourceUri.startsWith(Paths.cache.uri)) deleteQuietly(new File(sourceUri));
}

/** Deletes a recording that was never attached, if the camera or picker left it in the cache. */
export function discardCapturedVideo(sourceUri: string): void {
    if (sourceUri.startsWith(Paths.cache.uri)) deleteQuietly(new File(sourceUri));
}

export function removeSetVideo(setUuid: string): void {
    const video = getSetVideo(setUuid);
    if (!video) return;
    deleteSetVideoRow(setUuid);
    deleteQuietly(new File(videoDir(), video.file_name));
}

/** Call before deleting a set, while its uuid can still be looked up. */
export function removeVideoOfSet(setId: number): void {
    const uuid = getSetUuid(setId);
    if (uuid) removeSetVideo(uuid);
}

/**
 * Drops what no longer belongs together: rows whose set was deleted (here, by
 * sync, or by removing a whole exercise or workout) or whose file is gone, and
 * files no row points at. Run once at startup.
 */
export function sweepSetVideos(): void {
    const dir = videoDir();
    const files = dir.exists ? dir.list().filter((entry): entry is File => entry instanceof File) : [];
    const fileNames = new Set(files.map((f) => f.name));
    const setUuids = listSetUuids();
    const kept = new Set<string>();

    for (const video of listSetVideos()) {
        if (setUuids.has(video.set_uuid) && fileNames.has(video.file_name)) {
            kept.add(video.file_name);
        } else {
            deleteSetVideoRow(video.set_uuid);
        }
    }
    for (const file of files) {
        if (!kept.has(file.name)) deleteQuietly(file);
    }
}

function deleteQuietly(file: File): void {
    try {
        if (file.exists) file.delete();
    } catch { /* already gone */ }
}
