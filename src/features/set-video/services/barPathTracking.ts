import { extractGrayFrames, FRAME_TIME_BYTES, FRAMES_HEADER_BYTES, isVideoFramesAvailable } from "@/modules/video-frames";
import { Directory, File, Paths } from "expo-file-system";
import { PlateTracker } from "../helpers/plateTracker";
import type { BarPathData, GrayFrame, Marker } from "../types";

// Frames are analysed at this size (longer side): plenty to place a plate to a
// fraction of a centimetre, and a frame is only ~60 kB.
const ANALYSIS_SIDE = 320;
const MAX_FPS = 30;
// About a minute at full rate; longer videos are read at a lower rate.
const MAX_FRAMES = 1800;
// Tracking hands control back to the UI after working this long, so the
// screen stays responsive without paying for a pause after every few frames.
const SLICE_MS = 50;
// How often to look whether more of the video has been decoded.
const POLL_MS = 25;
const FRAMES_FILE_PREFIX = "bar-path-frames-";

export { isVideoFramesAvailable };

/**
 * A video's frames, decoded to a file in the background and read from it one
 * at a time, also while the rest are still being decoded.
 */
export interface FrameSource {
    width: number;
    height: number;
    /** Frames decoded so far. */
    count: () => number;
    /** Whether the whole video has been decoded (or decoding failed). */
    isFinished: () => boolean;
    /** Resolves once the whole video is decoded; rejects when decoding fails. */
    finished: Promise<void>;
    read: (index: number) => { frame: GrayFrame; t: number };
    /** Deletes the decoded frames. */
    dispose: () => void;
}

/**
 * Starts decoding the video for analysis and resolves as soon as its first
 * frame is there, so the plate can be marked while the rest is decoded.
 * `durationMs` lowers the frame rate of long videos.
 */
export async function openFrames(videoUri: string, durationMs: number | null): Promise<FrameSource> {
    const seconds = Math.max(1, (durationMs ?? 0) / 1000);
    const maxFps = Math.min(MAX_FPS, MAX_FRAMES / seconds);
    const file = new File(Paths.cache, `${FRAMES_FILE_PREFIX}${Date.now()}.gray`);
    let done = false;
    let failure: unknown = null;
    const finished = extractGrayFrames(videoUri, file.uri, { maxSide: ANALYSIS_SIDE, maxFps, maxFrames: MAX_FRAMES })
        .then(() => { done = true; }, (e: unknown) => { done = true; failure = e; throw e; });
    // Whoever needs the outcome awaits `finished`; this only keeps an unawaited failure from being reported as unhandled.
    finished.catch(() => { /* see above */ });

    const size = () => (file.exists ? file.size : 0);
    // The header comes with the first frame; wait for both.
    let width = 0, height = 0;
    for (;;) {
        if (failure) throw failure;
        if (width === 0 && size() >= FRAMES_HEADER_BYTES) {
            const header = file.open();
            try {
                const view = new DataView(header.readBytes(FRAMES_HEADER_BYTES).buffer);
                width = view.getInt32(0, true);
                height = view.getInt32(4, true);
            } finally {
                header.close();
            }
        }
        if (width > 0 && size() >= FRAMES_HEADER_BYTES + FRAME_TIME_BYTES + width * height) break;
        if (done) throw new Error("The video has no frames");
        await pause(POLL_MS);
    }

    const recordBytes = FRAME_TIME_BYTES + width * height;
    const handle = file.open();
    return {
        width,
        height,
        count: () => Math.max(0, Math.floor((size() - FRAMES_HEADER_BYTES) / recordBytes)),
        isFinished: () => done,
        finished,
        read: (index) => {
            handle.offset = FRAMES_HEADER_BYTES + index * recordBytes;
            const record = handle.readBytes(recordBytes);
            const t = new DataView(record.buffer, record.byteOffset, FRAME_TIME_BYTES).getFloat64(0, true);
            return { t, frame: { width, height, data: record.subarray(FRAME_TIME_BYTES) } };
        },
        dispose: () => {
            try { handle.close(); } catch { /* already closed */ }
            // A decode still running keeps writing to the deleted file until it ends; the space is freed then.
            try { if (file.exists) file.delete(); } catch { /* already gone */ }
        },
    };
}

function pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deletes decoded frames left behind when the app was closed while a video
 * was being marked (they are tens of megabytes). Run once at startup.
 */
export function sweepFrameFiles(): void {
    const cache = new Directory(Paths.cache);
    if (!cache.exists) return;
    for (const entry of cache.list()) {
        if (entry instanceof File && entry.name.startsWith(FRAMES_FILE_PREFIX)) {
            try { entry.delete(); } catch { /* already gone */ }
        }
    }
}

interface TrackOptions {
    source: FrameSource;
    /** Placed on the first frame, in its pixels. */
    marker: Marker;
    plateDiameterM: number;
    /** The video's length, for the progress while its end is still being decoded. */
    durationMs: number | null;
    onProgress: (share: number) => void;
    /** Checked between slices; tracking stops early (and resolves null) once it returns true. */
    isCancelled: () => boolean;
}

/**
 * Follows the marked plate through every frame, keeping up with the decoding
 * when it gets ahead of it. Runs on the JS thread in slices, yielding between
 * them so the screen stays responsive. Rejects when decoding fails.
 */
export async function trackBarPath({ source, marker, plateDiameterM, durationMs, onProgress, isCancelled }: TrackOptions): Promise<BarPathData | null> {
    const tracker = new PlateTracker(source.read(0).frame, marker);
    const t: number[] = [], x: number[] = [], y: number[] = [], score: number[] = [];

    let sliceStart = Date.now();
    for (let i = 0; ; i++) {
        // Wait for the frame to be decoded; once decoding is over, the frames there are are all.
        while (i >= source.count()) {
            if (source.isFinished()) {
                await source.finished;
                if (i >= source.count()) break;
            } else {
                if (isCancelled()) return null;
                await pause(POLL_MS);
                sliceStart = Date.now();
            }
        }
        if (i >= source.count()) break;

        if (Date.now() - sliceStart >= SLICE_MS) {
            if (isCancelled()) return null;
            onProgress(progressAt(t[t.length - 1] ?? 0, i, source, durationMs));
            await pause(0);
            sliceStart = Date.now();
        }
        const { frame, t: ms } = source.read(i);
        const point = tracker.track(frame, ms);
        t.push(Math.round(point.t));
        x.push(round2(point.x));
        y.push(round2(point.y));
        score.push(round2(point.score));
    }
    onProgress(1);
    return {
        version: 1,
        frameWidth: source.width,
        frameHeight: source.height,
        marker,
        plateDiameterM,
        t, x, y, score,
    };
}

/** How far through the video tracking is, 0 to 1: by time while decoding goes on, by frames after. */
function progressAt(ms: number, index: number, source: FrameSource, durationMs: number | null): number {
    if (source.isFinished()) return index / Math.max(1, source.count());
    return durationMs ? Math.min(0.99, ms / durationMs) : 0;
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
