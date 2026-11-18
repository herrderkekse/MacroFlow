import { useCallback, useEffect, useRef, useState } from "react";
import { getSetVideo } from "../services/setVideoDb";
import { setVideoUri } from "../services/setVideoFiles";
import logger from "@/src/utils/logger";
import { STANDARD_PLATE_M } from "../constants";
import { snapPlate } from "../helpers/plateDetector";
import { getBarPath, putBarPath } from "../services/barPathDb";
import { isVideoFramesAvailable, openFrames, trackBarPath, type FrameSource } from "../services/barPathTracking";
import type { BarPathData, GrayFrame, Marker } from "../types";

/**
 * - `reading`: decoding of the video has started; its first frame is not there yet
 * - `place`: waiting for the plate to be marked on the first frame (the rest of
 *   the video is decoded meanwhile)
 * - `tracking`: following the plate through the video, as far as it is decoded
 * - `result`: a path has been tracked
 * - `missing`: the set has no video (anymore)
 * - `unavailable`: this build can't read video frames
 * - `failed`: the video couldn't be read
 */
export type BarPathPhase = "reading" | "place" | "tracking" | "result" | "missing" | "unavailable" | "failed";

// How much one tap on "smaller"/"larger" resizes the marker.
const RESIZE_STEP = 1.08;

/**
 * Everything the bar path mode does with one set's video. Reading the video
 * starts once the mode is first `active`, and goes on (as does tracking) while
 * another mode is shown.
 */
export function useBarPathSession(setUuid: string, active: boolean) {
    const [video] = useState(() => getSetVideo(setUuid));
    const [path, setPath] = useState<BarPathData | null>(() => (video ? getBarPath(setUuid, video.file_name) : null));
    const [phase, setPhase] = useState<BarPathPhase>(() => initialPhase(!!video, path != null));
    const [firstFrame, setFirstFrame] = useState<GrayFrame | null>(null);
    const [marker, setMarker] = useState<Marker | null>(null);
    const [plateDiameterM, setPlateDiameterM] = useState(path?.plateDiameterM ?? STANDARD_PLATE_M);
    const [progress, setProgress] = useState(0);
    const frames = useRef<FrameSource | null>(null);
    const reading = useRef(false);
    const alive = useRef(true);
    const videoUri = video ? setVideoUri(video) : null;

    const releaseFrames = useCallback(() => {
        frames.current?.dispose();
        frames.current = null;
    }, []);

    const startPlacing = useCallback(async () => {
        if (!video || !videoUri || reading.current) return;
        if (frames.current) { setPhase("place"); return; }
        reading.current = true;
        setPhase("reading");
        try {
            const startedAt = Date.now();
            const source = await openFrames(videoUri, video.duration_ms);
            logger.debug("[BarPath] First frame read", { ms: Date.now() - startedAt });
            source.finished.then(
                () => logger.debug("[BarPath] Read the video", { frames: source.count(), ms: Date.now() - startedAt }),
                () => { /* reported by tracking, which waits for it */ },
            );
            if (!alive.current) { source.dispose(); return; }
            frames.current = source;
            setFirstFrame(source.read(0).frame);
            setPhase("place");
        } catch (e) {
            logger.warn("[BarPath] Failed to read the video", e instanceof Error ? e.message : e);
            if (alive.current) setPhase("failed");
        } finally {
            reading.current = false;
        }
    }, [video, videoUri]);

    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            releaseFrames();
        };
    }, [releaseFrames]);

    // The mode opens on reading the video when there is no path yet.
    useEffect(() => {
        if (active && phase === "reading" && !frames.current) queueMicrotask(() => void startPlacing());
    }, [active, phase, startPlacing]);

    const place = useCallback((x: number, y: number) => {
        if (firstFrame) setMarker(snapPlate(firstFrame, x, y));
    }, [firstFrame]);

    const resize = useCallback((larger: boolean) => {
        setMarker((m) => (m ? { ...m, r: larger ? m.r * RESIZE_STEP : m.r / RESIZE_STEP } : m));
    }, []);

    const track = useCallback(async () => {
        const source = frames.current;
        if (!video || !source || !marker) return;
        setPhase("tracking");
        setProgress(0);
        const startedAt = Date.now();
        let tracked: BarPathData | null;
        try {
            tracked = await trackBarPath({
                source, marker, plateDiameterM, durationMs: video.duration_ms,
                onProgress: (share) => { if (alive.current) setProgress(share); },
                isCancelled: () => !alive.current,
            });
        } catch (e) {
            logger.warn("[BarPath] Failed to read the video", e instanceof Error ? e.message : e);
            releaseFrames();
            if (alive.current) setPhase("failed");
            return;
        }
        if (!tracked || !alive.current) return;
        logger.debug("[BarPath] Tracked the plate", { frames: tracked.t.length, ms: Date.now() - startedAt });
        putBarPath(setUuid, video.file_name, tracked);
        releaseFrames();
        setPath(tracked);
        setPhase("result");
    }, [video, marker, plateDiameterM, setUuid, releaseFrames]);

    /** Back to marking the plate, starting from the marker used last time. */
    const redo = useCallback(() => {
        if (!isVideoFramesAvailable()) return;
        setMarker(path?.marker ?? null);
        void startPlacing();
    }, [path, startPlacing]);

    /** Corrects the plate's real size; a tracked path is rescaled, not tracked again. */
    const changePlateDiameter = useCallback((metres: number) => {
        setPlateDiameterM(metres);
        if (path && video) {
            const next = { ...path, plateDiameterM: metres };
            putBarPath(setUuid, video.file_name, next);
            setPath(next);
        }
    }, [path, video, setUuid]);

    return {
        phase, path, firstFrame, marker, plateDiameterM, progress,
        canRedo: isVideoFramesAvailable() && !!video,
        place, resize, track, redo, changePlateDiameter,
        /** Leave placing without tracking, back to the stored path. */
        cancelPlacing: path ? () => setPhase("result") : null,
    };
}

function initialPhase(hasVideo: boolean, hasPath: boolean): BarPathPhase {
    if (!hasVideo) return "missing";
    if (hasPath) return "result";
    return isVideoFramesAvailable() ? "reading" : "unavailable";
}
