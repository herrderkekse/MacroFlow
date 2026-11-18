import { useEvent } from "expo";
import { useVideoPlayer, type VideoPlayer, type VideoThumbnail } from "expo-video";
import { useCallback, useEffect, useState } from "react";

// The player is a native object driven imperatively; seeking it is not React state.
function seek(player: VideoPlayer, ms: number) {
    player.currentTime = ms / 1000;
}

/** Plays a set's video under its bar path: muted and looping. */
export function usePathPlayer(uri: string | null, needsFirstFrame: boolean) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.muted = true;
        p.audioMixingMode = "auto";
    });
    const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing, oldIsPlaying: undefined });


    // A paused player doesn't reliably draw a frame before it has played, so
    // the first frame, where the plate is marked, is shown as a picture.
    const loaded = useEvent(player, "sourceLoad", null);
    const [firstFrame, setFirstFrame] = useState<VideoThumbnail | null>(null);
    useEffect(() => {
        // Only while marking: generating it holds up the playing video's picture on some devices.
        if (!loaded || !needsFirstFrame || firstFrame) return;
        let cancelled = false;
        player.generateThumbnailsAsync([0], { maxWidth: 1080 })
            .then(([thumb]) => { if (!cancelled) setFirstFrame(thumb ?? null); })
            .catch(() => { /* not supported here: the video itself shows */ });
        return () => { cancelled = true; };
    }, [player, loaded, needsFirstFrame, firstFrame]);

    const togglePlaying = useCallback(() => {
        if (player.playing) player.pause();
        else player.play();
    }, [player]);

    const playFrom = useCallback((ms: number) => {
        seek(player, ms);
        player.play();
    }, [player]);

    /** Stops on the first frame, where the plate is marked. */
    const showFirstFrame = useCallback(() => {
        player.pause();
        seek(player, 0);
    }, [player]);

    return { player, isPlaying, firstFrame, togglePlaying, playFrom, showFirstFrame };
}
