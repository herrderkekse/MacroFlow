import { useEventListener } from "expo";
import { useCallback, useEffect, useState } from "react";
import { REPORT_INTERVAL_S, setReportInterval, type VideoPlayback } from "./useVideoPlayback";

// Reported often while trimming, so the clip loops close to its end handle.
const TRIM_INTERVAL_S = 0.05;

/**
 * The kept range of the video being trimmed. While `active`, playback loops
 * inside it; while a handle is dragged, playback pauses and shows the frame
 * under it, and letting go plays the clip from its start again. The range
 * stays when another mode is shown meanwhile.
 */
export function useTrimRange(playback: VideoPlayback, active: boolean) {
    const { player, durationMs, seekTo, scrubStart, scrubTo, scrubEnd, isScrubbing } = playback;
    // null = untouched: the whole video, whatever its duration turns out to be.
    const [range, setRange] = useState<{ startMs: number; endMs: number } | null>(null);
    const startMs = range?.startMs ?? 0;
    const endMs = range?.endMs ?? durationMs;
    const [positionMs, setPositionMs] = useState(0);

    useEffect(() => {
        if (!active) return;
        setReportInterval(player, TRIM_INTERVAL_S);
        return () => {
            // On leaving the screen (or reloading it after a save), the player
            // is released before this runs, and a released one can't be set;
            // it doesn't need its interval back either.
            try {
                setReportInterval(player, REPORT_INTERVAL_S);
            } catch { /* released */ }
        };
    }, [player, active]);

    useEventListener(player, "timeUpdate", ({ currentTime }) => {
        if (!active) return;
        const ms = currentTime * 1000;
        setPositionMs(ms);
        if (isScrubbing() || endMs <= 0 || !player.playing) return;
        // Loop the kept range instead of the whole video.
        if (ms >= endMs || ms < startMs - 100) seekTo(startMs);
    });

    const setTrim = useCallback((start: number, end: number) => setRange({ startMs: start, endMs: end }), []);

    const onScrub = useCallback((ms: number) => {
        scrubTo(ms);
        setPositionMs(ms);
    }, [scrubTo]);

    const onScrubEnd = useCallback(() => {
        // Paused, the frame under the handle stays; playing, the clip plays from its start again.
        if (scrubEnd(false)) {
            seekTo(startMs);
            player.play();
        }
    }, [player, scrubEnd, seekTo, startMs]);

    /** Moves the playhead to `ms`, inside the kept range. */
    const seekInside = useCallback((ms: number) => {
        const clamped = Math.min(Math.max(ms, startMs), endMs);
        seekTo(clamped);
        setPositionMs(clamped);
    }, [seekTo, startMs, endMs]);

    return { startMs, endMs, positionMs, setTrim, onScrubStart: scrubStart, onScrub, onScrubEnd, seekInside };
}
