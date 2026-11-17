import { useEvent, useEventListener } from "expo";
import { useVideoPlayer, type VideoPlayer, type VideoThumbnail } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";

const THUMBNAIL_COUNT = 8;

// The player is a native object driven imperatively; seeking it is not React state.
function seek(player: VideoPlayer, ms: number) {
    player.currentTime = ms / 1000;
}

function setScrubbing(player: VideoPlayer, enabled: boolean) {
    player.scrubbingModeOptions = { scrubbingModeEnabled: enabled };
}

/**
 * Plays a video on the trim screen, looping inside the kept range, and holds
 * that range. While a handle is dragged, playback pauses and shows the frame
 * under it; letting go plays the clip from its start again.
 */
export function useTrimPlayer(source: string) {
    const player = useVideoPlayer(source, (p) => {
        p.timeUpdateEventInterval = 0.05;
        // Trimming is about the picture; a silent preview leaves the gym music playing.
        p.muted = true;
        p.audioMixingMode = "auto";
        p.play();
    });
    const loaded = useEvent(player, "sourceLoad", null);
    const durationMs = Math.round((loaded?.duration ?? 0) * 1000);
    const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing, oldIsPlaying: undefined });

    // null = untouched: the whole video, whatever its duration turns out to be.
    const [range, setRange] = useState<{ startMs: number; endMs: number } | null>(null);
    const startMs = range?.startMs ?? 0;
    const endMs = range?.endMs ?? durationMs;
    const [positionMs, setPositionMs] = useState(0);
    const [thumbnails, setThumbnails] = useState<VideoThumbnail[]>([]);
    const scrub = useRef({ active: false, wasPlaying: false });

    useEventListener(player, "timeUpdate", ({ currentTime }) => {
        const ms = currentTime * 1000;
        setPositionMs(ms);
        if (scrub.current.active || endMs <= 0) return;
        // Loop the kept range instead of the whole video.
        if (ms >= endMs || ms < startMs - 100) seek(player, startMs);
    });

    useEffect(() => {
        if (durationMs <= 0) return;
        const times = Array.from({ length: THUMBNAIL_COUNT }, (_, i) => ((i + 0.5) / THUMBNAIL_COUNT) * (durationMs / 1000));
        let cancelled = false;
        player.generateThumbnailsAsync(times, { maxWidth: 160 })
            .then((thumbs) => { if (!cancelled) setThumbnails(thumbs); })
            .catch(() => { /* not supported here (web): an empty filmstrip */ });
        return () => { cancelled = true; };
    }, [player, durationMs]);

    const setTrim = useCallback((start: number, end: number) => setRange({ startMs: start, endMs: end }), []);

    const onScrubStart = useCallback(() => {
        scrub.current = { active: true, wasPlaying: player.playing };
        player.pause();
        // Many seeks in a row: let the player skip decoding work so each one shows a frame.
        setScrubbing(player, true);
    }, [player]);

    const onScrub = useCallback((ms: number) => seek(player, ms), [player]);

    const onScrubEnd = useCallback(() => {
        const { wasPlaying } = scrub.current;
        scrub.current = { active: false, wasPlaying: false };
        setScrubbing(player, false);
        // Paused, the frame under the handle stays; playing, the clip plays from its start again.
        if (wasPlaying) {
            seek(player, startMs);
            player.play();
        }
    }, [player, startMs]);

    /** Moves the playhead to `ms`, inside the kept range. */
    const seekTo = useCallback((ms: number) => {
        const clamped = Math.min(Math.max(ms, startMs), endMs);
        seek(player, clamped);
        setPositionMs(clamped);
    }, [player, startMs, endMs]);

    const togglePlaying = useCallback(() => {
        if (player.playing) player.pause();
        else player.play();
    }, [player]);

    return {
        player, durationMs, isPlaying, positionMs, thumbnails,
        startMs, endMs, setTrim, onScrubStart, onScrub, onScrubEnd, seekTo, togglePlaying,
    };
}
