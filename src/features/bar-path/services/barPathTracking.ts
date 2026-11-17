import { extractGrayFrames, isVideoFramesAvailable } from "@/modules/video-frames";
import { Directory, File, Paths } from "expo-file-system";
import { PlateTracker } from "../helpers/plateTracker";
import type { BarPathData, GrayFrame, Marker } from "../types";

// Frames are analysed at this size (longer side): plenty to place a plate to a
// fraction of a centimetre, and a frame is only ~60 kB.
const ANALYSIS_SIDE = 320;
const MAX_FPS = 30;
// About a minute at full rate; longer videos are read at a lower rate.
const MAX_FRAMES = 1800;
// Tracking hands control back to the UI after this many frames.
const FRAMES_PER_SLICE = 6;
const FRAMES_FILE_PREFIX = "bar-path-frames-";

export { isVideoFramesAvailable };

/** A video's frames, decoded to a file and read from it one at a time. */
export interface FrameSource {
    width: number;
    height: number;
    timesMs: number[];
    read: (index: number) => GrayFrame;
    /** Deletes the decoded frames. */
    dispose: () => void;
}

/** Decodes the video for analysis. `durationMs` lowers the frame rate of long videos. */
export async function openFrames(videoUri: string, durationMs: number | null): Promise<FrameSource> {
    const seconds = Math.max(1, (durationMs ?? 0) / 1000);
    const maxFps = Math.min(MAX_FPS, MAX_FRAMES / seconds);
    const file = new File(Paths.cache, `${FRAMES_FILE_PREFIX}${Date.now()}.gray`);
    const result = await extractGrayFrames(videoUri, file.uri, { maxSide: ANALYSIS_SIDE, maxFps, maxFrames: MAX_FRAMES });
    const { width, height, timesMs } = result;
    const frameBytes = width * height;
    const decoded = new File(result.uri);
    const handle = decoded.open();
    return {
        width,
        height,
        timesMs,
        read: (index) => {
            handle.offset = index * frameBytes;
            return { width, height, data: handle.readBytes(frameBytes) };
        },
        dispose: () => {
            try { handle.close(); } catch { /* already closed */ }
            try { if (decoded.exists) decoded.delete(); } catch { /* already gone */ }
        },
    };
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
    onProgress: (share: number) => void;
    /** Checked between slices; tracking stops early (and resolves null) once it returns true. */
    isCancelled: () => boolean;
}

/**
 * Follows the marked plate through every frame. Runs on the JS thread in
 * slices, yielding between them so the screen stays responsive.
 */
export async function trackBarPath({ source, marker, plateDiameterM, onProgress, isCancelled }: TrackOptions): Promise<BarPathData | null> {
    const { timesMs } = source;
    const tracker = new PlateTracker(source.read(0), marker);
    const t: number[] = [], x: number[] = [], y: number[] = [], score: number[] = [];

    for (let i = 0; i < timesMs.length; i++) {
        if (i % FRAMES_PER_SLICE === 0) {
            if (isCancelled()) return null;
            onProgress(i / timesMs.length);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const point = tracker.track(source.read(i), timesMs[i]);
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

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
