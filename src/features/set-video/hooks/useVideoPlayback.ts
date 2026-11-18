import { useEvent } from "expo";
import { useVideoPlayer, type VideoPlayer, type VideoThumbnail } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { stepFrameMs } from "../helpers/frameStep";

const THUMBNAIL_COUNT = 8;
/** How often the player reports its position, unless a mode asks for more (trimming). */
export const REPORT_INTERVAL_S = 0.25;
/** The speeds offered, cycled through by one button. */
export const PLAYBACK_RATES = [1, 0.5, 0.25] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

const SEEK_RULE = Platform.OS === "ios" ? "atOrBefore" : "atOrAfter";

// The player is a native object driven imperatively; setting its properties is not React state.
function setScrubbing(player: VideoPlayer, enabled: boolean) {
    player.scrubbingModeOptions = { scrubbingModeEnabled: enabled };
}

function seek(player: VideoPlayer, ms: number) {
    player.currentTime = ms / 1000;
}

function setRate(player: VideoPlayer, rate: number) {
    player.playbackRate = rate;
}

function toggleMute(player: VideoPlayer) {
    player.muted = !player.muted;
}

/** How often the player reports where it is, in seconds. */
export function setReportInterval(player: VideoPlayer, seconds: number) {
    player.timeUpdateEventInterval = seconds;
}

/**
 * The one player of the set video screen, shared by its modes so switching
 * between them keeps the picture and the position. Muted: watching a set is
 * about the picture, and a silent video leaves the gym music playing.
 */
export function useVideoPlayback(uri: string) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.muted = true;
        p.audioMixingMode = "auto";
        p.timeUpdateEventInterval = REPORT_INTERVAL_S;
        p.play();
    });
    const loaded = useEvent(player, "sourceLoad", null);
    const durationMs = Math.round((loaded?.duration ?? 0) * 1000);
    const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing, oldIsPlaying: undefined });
    const { muted } = useEvent(player, "mutedChange", { muted: player.muted, oldMuted: undefined });
    const [rate, setRateState] = useState<PlaybackRate>(1);
    const [thumbnails, setThumbnails] = useState<VideoThumbnail[]>([]);

    // Seeks are announced, so what draws the position follows a paused video at once.
    const seekListeners = useRef(new Set<(ms: number) => void>());
    const scrub = useRef({ active: false, wasPlaying: false, lastMs: 0 });

    // The video's shape as shown, so its box has its final size from the
    // first picture on. The tracks' sizes ignore a phone video's rotation, so
    // it is read from one small frame instead, which is upright: undefined
    // while that is under way, null if it couldn't be read.
    const [firstAspect, setFirstAspect] = useState<number | null | undefined>(undefined);
    useEffect(() => {
        if (durationMs <= 0) return;
        let cancelled = false;
        player.generateThumbnailsAsync([0], { maxWidth: 64 })
            .then(([thumb]) => { if (!cancelled) setFirstAspect(thumb && thumb.height > 0 ? thumb.width / thumb.height : null); })
            .catch(() => { if (!cancelled) setFirstAspect(null); });
        return () => { cancelled = true; };
    }, [player, durationMs]);

    useEffect(() => {
        if (durationMs <= 0) return;
        const times = Array.from({ length: THUMBNAIL_COUNT }, (_, i) => ((i + 0.5) / THUMBNAIL_COUNT) * (durationMs / 1000));
        let cancelled = false;
        player.generateThumbnailsAsync(times, { maxWidth: 160 })
            .then((thumbs) => { if (!cancelled) setThumbnails(thumbs); })
            .catch(() => { /* not supported here (web): an empty filmstrip */ });
        return () => { cancelled = true; };
    }, [player, durationMs]);

    const first = thumbnails[0];
    // The filmstrip's frames stand in if the first one couldn't be read.
    const aspect = firstAspect ?? (first && first.height > 0 ? first.width / first.height : null);
    /** False until the video's shape is known, or known not to be knowable (web). */
    const shapeKnown = firstAspect !== undefined;

    const seekTo = useCallback((ms: number) => {
        const clamped = Math.min(Math.max(ms, 0), durationMs > 0 ? durationMs : ms);
        seek(player, clamped);
        seekListeners.current.forEach((listener) => listener(clamped));
    }, [player, durationMs]);

    const subscribeSeek = useCallback((listener: (ms: number) => void) => {
        seekListeners.current.add(listener);
        return () => { seekListeners.current.delete(listener); };
    }, []);

    const togglePlaying = useCallback(() => {
        if (player.playing) player.pause();
        else player.play();
    }, [player]);

    const play = useCallback(() => player.play(), [player]);
    const pause = useCallback(() => player.pause(), [player]);

    /** Pauses and shows the next (+1) or previous (-1) frame. */
    const stepFrame = useCallback((direction: 1 | -1) => {
        player.pause();
        seekTo(stepFrameMs({
            currentMs: player.currentTime * 1000,
            direction,
            fps: player.videoTrack?.frameRate,
            durationMs,
            rule: SEEK_RULE,
        }));
    }, [player, durationMs, seekTo]);

    const cycleRate = useCallback(() => {
        const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length];
        setRate(player, next);
        setRateState(next);
    }, [player, rate]);

    const toggleMuted = useCallback(() => toggleMute(player), [player]);

    const scrubStart = useCallback(() => {
        scrub.current = { active: true, wasPlaying: player.playing, lastMs: player.currentTime * 1000 };
        player.pause();
        // Many seeks in a row: let the player skip decoding work so each one shows a frame.
        setScrubbing(player, true);
    }, [player]);

    const scrubTo = useCallback((ms: number) => {
        scrub.current.lastMs = ms;
        seekTo(ms);
    }, [seekTo]);

    /**
     * Ends a scrub and plays on if it played before, unless `resume` is false.
     * Returns whether it played before.
     */
    const scrubEnd = useCallback((resume = true): boolean => {
        const { wasPlaying, lastMs } = scrub.current;
        scrub.current = { active: false, wasPlaying: false, lastMs: 0 };
        setScrubbing(player, false);
        // Scrubbing seeks loosely; land on the exact frame under the finger.
        seekTo(lastMs);
        if (wasPlaying && resume) player.play();
        return wasPlaying;
    }, [player, seekTo]);

    const isScrubbing = useCallback(() => scrub.current.active, []);

    return useMemo(() => ({
        player, durationMs, isPlaying, muted, rate, thumbnails, aspect, shapeKnown,
        seekTo, subscribeSeek, togglePlaying, play, pause, stepFrame, cycleRate, toggleMuted,
        scrubStart, scrubTo, scrubEnd, isScrubbing,
    }), [
        player, durationMs, isPlaying, muted, rate, thumbnails, aspect, shapeKnown,
        seekTo, subscribeSeek, togglePlaying, play, pause, stepFrame, cycleRate, toggleMuted,
        scrubStart, scrubTo, scrubEnd, isScrubbing,
    ]);
}

export type VideoPlayback = ReturnType<typeof useVideoPlayback>;
