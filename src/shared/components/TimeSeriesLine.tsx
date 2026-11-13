import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React from "react";
import { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { smoothPath } from "@/src/utils/plotPaths";
import type { PlotPoint } from "./TimeSeriesPlot";

interface TimeSeriesLineProps {
    points: PlotPoint[];
    /** Whether the single values are marked. */
    showDots: boolean;
    picked: PlotPoint | undefined;
    color: string;
    /** Scales of the plot this is drawn in: days and values to its coordinates. */
    xAt: (pos: number) => number;
    yAt: (value: number) => number;
    top: number;
    bottom: number;
}

/**
 * A level over time, for TimeSeriesPlot's SVG. Measurements that come with a
 * trend are quiet dots with the trend drawn through them; values that stand
 * for themselves are joined by the line and marked on it. The picked day is
 * marked either way.
 */
export default function TimeSeriesLine({ points, showDots, picked, color, xAt, yAt, top, bottom }: TimeSeriesLineProps) {
    const colors = useThemeColors();
    const smoothed = points.some((p) => p.trend != null);
    const line = points.map((p) => ({ x: xAt(p.day + 0.5), y: yAt(p.trend ?? p.value) }));
    const path = smoothPath(line);
    const first = line[0];
    const last = line[line.length - 1];
    const pickedX = picked ? xAt(picked.day + 0.5) : 0;
    const dotRadius = points.length > 45 ? 1.75 : 2.5;

    return (
        <>
            <Defs>
                <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color} stopOpacity={0.14} />
                    <Stop offset="1" stopColor={color} stopOpacity={0} />
                </LinearGradient>
            </Defs>
            {picked && <Line x1={pickedX} x2={pickedX} y1={top} y2={bottom} stroke={colors.borderStrong} strokeWidth={1} />}
            {line.length > 1 && <Path d={`${path}L${last.x} ${bottom}L${first.x} ${bottom}Z`} fill="url(#wash)" />}
            {showDots &&
                smoothed &&
                points.map((p) => (
                    <Circle key={p.day} cx={xAt(p.day + 0.5)} cy={yAt(p.value)} r={dotRadius} fill={color} fillOpacity={0.4} />
                ))}
            <Path d={path} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {showDots &&
                !smoothed &&
                points.map((p) => (
                    <Circle
                        key={p.day}
                        cx={xAt(p.day + 0.5)}
                        cy={yAt(p.value)}
                        r={dotRadius + 1}
                        fill={color}
                        stroke={colors.surface}
                        strokeWidth={1.5}
                    />
                ))}
            {picked ? (
                <>
                    {picked.trend != null && (
                        <Circle cx={pickedX} cy={yAt(picked.trend)} r={3} fill={colors.surface} stroke={color} strokeWidth={2} />
                    )}
                    <Circle cx={pickedX} cy={yAt(picked.value)} r={4.5} fill={color} stroke={colors.surface} strokeWidth={2} />
                </>
            ) : (
                <Circle cx={last.x} cy={last.y} r={4} fill={color} stroke={colors.surface} strokeWidth={2} />
            )}
        </>
    );
}
