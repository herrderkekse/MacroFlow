import { useEventListener } from "expo";
import type { VideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";

// How often the player reports its position; in between, it is extrapolated.
const REPORT_INTERVAL_S = 0.25;

/**
 * The player's position in milliseconds, updated on every frame drawn while it
 * plays. The player reports its position a few times a second and the clock
 * fills in between: asking the player on every frame stalls its picture, and
 * waiting for its reports alone makes a drawing over the video trail behind.
 * Use it in the component that draws, so the rest of the screen (and the
 * video view) doesn't re-render with it.
 */
export function usePlayerPosition(player: VideoPlayer, isPlaying: boolean): number {
    const [ms, setMs] = useState(0);
    // The last report: where the video was, and when (on the clock below).
    const anchor = useRef({ ms: 0, at: 0 });

    useEffect(() => {
        player.timeUpdateEventInterval = REPORT_INTERVAL_S;
    }, [player]);

    useEventListener(player, "timeUpdate", ({ currentTime }) => {
        anchor.current = { ms: currentTime * 1000, at: performance.now() };
        setMs(currentTime * 1000);
    });

    useEffect(() => {
        if (!isPlaying) return;
        // Starting (again) from wherever the player was put.
        anchor.current = { ms: player.currentTime * 1000, at: performance.now() };
        // The screen plays at normal speed only.
        let frame = requestAnimationFrame(function update() {
            const { ms: from, at } = anchor.current;
            setMs(from + (performance.now() - at));
            frame = requestAnimationFrame(update);
        });
        return () => cancelAnimationFrame(frame);
    }, [player, isPlaying]);

    return ms;
}
