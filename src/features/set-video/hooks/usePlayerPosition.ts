import { useEventListener } from "expo";
import { useEffect, useRef, useState } from "react";
import type { VideoPlayback } from "./useVideoPlayback";

/**
 * The player's position in milliseconds, updated on every frame drawn while it
 * plays. The player reports its position a few times a second and the clock
 * fills in between: asking the player on every frame stalls its picture, and
 * waiting for its reports alone makes a drawing over the video trail behind.
 * Seeks show at once, so a paused video's playhead follows a scrub or a step.
 * Use it in the component that draws, so the rest of the screen (and the
 * video view) doesn't re-render with it.
 */
export function usePlayerPosition({ player, isPlaying, rate, subscribeSeek }: VideoPlayback): number {
    const [ms, setMs] = useState(() => player.currentTime * 1000);
    // The last report: where the video was, and when (on the clock below).
    const anchor = useRef({ ms: 0, at: 0 });

    useEventListener(player, "timeUpdate", ({ currentTime }) => {
        anchor.current = { ms: currentTime * 1000, at: performance.now() };
        setMs(currentTime * 1000);
    });

    useEffect(() => subscribeSeek((to) => {
        anchor.current = { ms: to, at: performance.now() };
        setMs(to);
    }), [subscribeSeek]);

    useEffect(() => {
        if (!isPlaying) return;
        // Starting (again) from wherever the player was put.
        anchor.current = { ms: player.currentTime * 1000, at: performance.now() };
        let frame = requestAnimationFrame(function update() {
            const { ms: from, at } = anchor.current;
            setMs(from + (performance.now() - at) * rate);
            frame = requestAnimationFrame(update);
        });
        return () => cancelAnimationFrame(frame);
    }, [player, isPlaying, rate]);

    return ms;
}
