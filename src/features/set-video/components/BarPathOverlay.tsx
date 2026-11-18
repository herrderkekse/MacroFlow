import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { fitContain, type Fit } from "../helpers/videoFit";
import { usePlayerPosition } from "../hooks/usePlayerPosition";
import type { VideoPlayback } from "../hooks/useVideoPlayback";
import type { Rep } from "../types";

// Drawn over the video, so it must not follow the theme (like text over a
// camera feed): white with a dark edge reads on any footage.
const INK = "#FFFFFF";
const EDGE = "rgba(0, 0, 0, 0.55)";
// Without a rep under way, the last moments of the path stand out.
const TRAIL_MS = 1500;

interface BarPathOverlayProps {
    frameWidth: number;
    frameHeight: number;
    /** The path in frame pixels, NaN where it is not known. */
    t: number[];
    x: number[];
    y: number[];
    reps: Rep[];
    /** The video; the path is drawn up to its position, and the plate there. */
    playback: VideoPlayback;
    plateRadius: number;
}

/** The bar's path over its video, fitted as the video is (`contentFit="contain"`). */
export default function BarPathOverlay({ frameWidth, frameHeight, t, x, y, reps, playback, plateRadius }: BarPathOverlayProps) {
    const currentMs = usePlayerPosition(playback);
    const [box, setBox] = useState({ width: 0, height: 0 });
    const fit = fitContain(box.width, box.height, frameWidth, frameHeight);
    const whole = pathData(fit, x, y, 0, x.length - 1);

    const now = indexAt(t, currentMs);
    const rep = reps.find((r) => currentMs >= r.startMs && currentMs <= r.liftEndMs + 300);
    const from = rep ? rep.startIndex : indexAt(t, currentMs - TRAIL_MS);
    const recent = pathData(fit, x, y, from, now);
    const cx = fit.left + x[now] * fit.scale;
    const cy = fit.top + y[now] * fit.scale;
    const hasPosition = Number.isFinite(cx) && Number.isFinite(cy);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setBox(e.nativeEvent.layout)}>
            {fit.scale > 0 && (
                <Svg width={box.width} height={box.height}>
                    <Path d={whole} stroke={INK} strokeOpacity={0.35} strokeWidth={2} fill="none" strokeLinejoin="round" />
                    <Path d={recent} stroke={EDGE} strokeWidth={6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    <Path d={recent} stroke={INK} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    {hasPosition && (
                        <>
                            <Circle cx={cx} cy={cy} r={plateRadius * fit.scale} stroke={EDGE} strokeWidth={4} fill="none" />
                            <Circle cx={cx} cy={cy} r={plateRadius * fit.scale} stroke={INK} strokeWidth={2} fill="none" />
                            <Circle cx={cx} cy={cy} r={4} fill={INK} stroke={EDGE} strokeWidth={1.5} />
                        </>
                    )}
                </Svg>
            )}
        </View>
    );
}

/** SVG path through points `from`..`to`, starting a new stroke after every gap. */
function pathData(fit: Fit, x: number[], y: number[], from: number, to: number): string {
    let d = "";
    let pen = false;
    for (let i = Math.max(0, from); i <= to && i < x.length; i++) {
        if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) { pen = false; continue; }
        const px = (fit.left + x[i] * fit.scale).toFixed(1);
        const py = (fit.top + y[i] * fit.scale).toFixed(1);
        d += `${pen ? "L" : "M"}${px} ${py} `;
        pen = true;
    }
    return d;
}

/** Index of the last frame at or before `ms` (0 before the first). */
function indexAt(t: number[], ms: number): number {
    let lo = 0, hi = t.length - 1;
    if (hi < 0 || ms <= t[0]) return 0;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (t[mid] <= ms) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
