import { useEvent } from "expo";
import type { VideoPlayer, VideoThumbnail } from "expo-video";
import { useEffect, useState } from "react";

/**
 * The video's first frame as a picture, where the plate is marked: a paused
 * player doesn't reliably draw a frame after a seek on every device. Only
 * made while `needed`: generating it holds up the playing video's picture on
 * some devices.
 */
export function useFirstFrame(player: VideoPlayer, needed: boolean): VideoThumbnail | null {
    const { status } = useEvent(player, "statusChange", { status: player.status });
    const loaded = status === "readyToPlay";
    const [firstFrame, setFirstFrame] = useState<VideoThumbnail | null>(null);
    useEffect(() => {
        if (!loaded || !needed || firstFrame) return;
        let cancelled = false;
        player.generateThumbnailsAsync([0], { maxWidth: 1080 })
            .then(([thumb]) => { if (!cancelled) setFirstFrame(thumb ?? null); })
            .catch(() => { /* not supported here: the video itself shows */ });
        return () => { cancelled = true; };
    }, [player, loaded, needed, firstFrame]);
    return firstFrame;
}
