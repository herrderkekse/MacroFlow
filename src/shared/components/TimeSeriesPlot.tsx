import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { G, Line, Path, Rect } from "react-native-svg";
import type { AxisScale, TimeTick } from "@/src/utils/chartScale";
import { roundedTopBar } from "@/src/utils/plotPaths";
import type { Headline } from "./ChartHeadline";
import TimeSeriesLine from "./TimeSeriesLine";

/** An amount for a stretch of days: `from` to `to` inclusive, counted from the start of the axis. */
export interface PlotColumn {
    from: number;
    to: number;
    /** Stacked from the baseline up. */
    segments: { value: number; color: string }[];
}

/** A level on one day. */
export interface PlotPoint {
    day: number;
    value: number;
    /**
     * The smoothed level, where the values are noisy measurements: the line
     * then follows this and the values are quiet dots behind it. Without it
     * the line runs through the values themselves.
     */
    trend?: number;
}

/** A reference value (a goal, a record) that held from day `from` up to, not including, day `to`. */
export interface PlotStep {
    from: number;
    to: number;
    value: number;
}

/** Everything a chart draws: columns for amounts or points for a level, never both. */
export interface TimeSeriesModel {
    /** Days on the time axis. */
    days: number;
    scale: AxisScale;
    ticks: TimeTick[];
    formatTick: (value: number) => string;
    columns?: PlotColumn[];
    points?: PlotPoint[];
    /** Whether the single values are marked on or behind the line. */
    showDots?: boolean;
    lineColor?: string;
    /** Drawn as a dashed line; the headline's `aside` says what it is. */
    reference?: PlotStep[];
    legend?: { color: string; label: string; mark: "dot" | "line" }[];
    headline: (selected: number | null) => Headline;
}

/** Room left of the plot for the value labels. */
const Y_AXIS_WIDTH = 40;
/** Room right of it, so that a mark on the last day is not cut off. */
const RIGHT_INSET = 6;
/** What the plot takes from the width it is given; the rest is the time axis. */
export const PLOT_INSET = Y_AXIS_WIDTH + RIGHT_INSET;
const PLOT_HEIGHT = 190;
const TOP = 8;
const X_AXIS_HEIGHT = 24;
/** Columns are slimmer than their slot: the air between them is what keeps a month of days legible. */
const COLUMN_FILL = 0.64;
const MAX_COLUMN_WIDTH = 20;

interface TimeSeriesPlotProps {
    model: TimeSeriesModel;
    width: number;
    /** Index of the selected column or point. */
    selected: number | null;
    onSelect: (index: number | null) => void;
    accessibilityLabel: string;
}

/**
 * The plot itself: columns for amounts, a line for a level, on a time axis
 * where every day has its place whether or not it was logged. Touching it
 * selects the nearest column or point; touching that one again lets go.
 */
export default function TimeSeriesPlot({ model, width, selected, onSelect, accessibilityLabel }: TimeSeriesPlotProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { days, scale, columns, points, reference, lineColor = colors.text } = model;

    const slot = (width - PLOT_INSET) / days;
    const bottom = TOP + PLOT_HEIGHT;
    const xAt = (pos: number) => Y_AXIS_WIDTH + pos * slot;
    const yAt = (value: number) => bottom - ((value - scale.min) / (scale.max - scale.min)) * PLOT_HEIGHT;

    // Where each selectable mark sits on the time axis, in days.
    const targets = useMemo(
        () => (columns ? columns.map((c) => (c.from + c.to + 1) / 2) : (points ?? []).map((p) => p.day + 0.5)),
        [columns, points],
    );

    const gesture = useMemo(() => {
        const nearest = (x: number) => {
            const pos = (x - Y_AXIS_WIDTH) / slot;
            let best = 0;
            targets.forEach((target, i) => {
                if (Math.abs(target - pos) < Math.abs(targets[best] - pos)) best = i;
            });
            return best;
        };
        // Sideways drags scrub; vertical ones are left to the page's scroll.
        const scrub = Gesture.Pan()
            .runOnJS(true)
            .activeOffsetX([-6, 6])
            .failOffsetY([-12, 12])
            .onStart((e) => onSelect(nearest(e.x)))
            .onUpdate((e) => onSelect(nearest(e.x)));
        const tap = Gesture.Tap()
            .runOnJS(true)
            .onEnd((e, success) => {
                if (!success) return;
                const index = nearest(e.x);
                onSelect(index === selected ? null : index);
            });
        return Gesture.Race(scrub, tap);
    }, [targets, slot, selected, onSelect]);

    return (
        <GestureDetector gesture={gesture}>
            <View
                style={{ width, height: bottom + X_AXIS_HEIGHT }}
                accessible
                accessibilityRole="image"
                accessibilityLabel={accessibilityLabel}
            >
                <Svg width={width} height={bottom + X_AXIS_HEIGHT}>
                    {scale.ticks.map((tick) => (
                        <Line
                            key={tick}
                            x1={Y_AXIS_WIDTH}
                            x2={width}
                            y1={yAt(tick)}
                            y2={yAt(tick)}
                            stroke={columns && tick === scale.min ? colors.borderStrong : colors.border}
                            strokeWidth={1}
                        />
                    ))}
                    {model.ticks.map((tick) => (
                        <Line
                            key={tick.pos}
                            x1={xAt(tick.pos)}
                            x2={xAt(tick.pos)}
                            y1={bottom}
                            y2={bottom + 4}
                            stroke={colors.borderStrong}
                            strokeWidth={1}
                        />
                    ))}

                    {columns?.map((column, i) => {
                        const span = (column.to - column.from + 1) * slot;
                        const barWidth = Math.max(1, Math.min(span * COLUMN_FILL, MAX_COLUMN_WIDTH));
                        const x = xAt(targets[i]) - barWidth / 2;
                        // Segments are told apart by a sliver of surface, not by an outline.
                        const gap = barWidth >= 5 ? 1.5 : 0;
                        let value = scale.min;
                        return (
                            <G key={column.from} opacity={selected == null || selected === i ? 1 : 0.35}>
                                {column.segments.map((segment, s) => {
                                    const y0 = yAt(value) - (s > 0 ? gap : 0);
                                    value += segment.value;
                                    const y1 = yAt(value);
                                    if (y0 - y1 <= 0) return null;
                                    return s === column.segments.length - 1 ? (
                                        <Path key={s} d={roundedTopBar(x, y1, barWidth, y0 - y1, 3)} fill={segment.color} />
                                    ) : (
                                        <Rect key={s} x={x} y={y1} width={barWidth} height={y0 - y1} fill={segment.color} />
                                    );
                                })}
                            </G>
                        );
                    })}

                    {/* Under a line and its marks, over the columns it is measured against. */}
                    {reference && reference.length > 0 && (
                        <Path
                            d={reference
                                .map((step, i) => {
                                    const joins = i > 0 && reference[i - 1].to === step.from;
                                    // Like the gridlines, it runs out to the edge of the card.
                                    const end = step.to >= days ? width : xAt(step.to);
                                    return `${joins ? "L" : "M"}${xAt(step.from)} ${yAt(step.value)}H${end}`;
                                })
                                .join("")}
                            stroke={colors.text}
                            strokeOpacity={0.55}
                            strokeWidth={1.25}
                            strokeDasharray="4 3"
                            fill="none"
                        />
                    )}

                    {points && (
                        <TimeSeriesLine
                            points={points}
                            showDots={model.showDots !== false}
                            picked={selected != null ? points[selected] : undefined}
                            color={lineColor}
                            xAt={xAt}
                            yAt={yAt}
                            top={TOP}
                            bottom={bottom}
                        />
                    )}
                </Svg>

                {scale.ticks.map((tick) => (
                    <Text key={tick} style={[styles.label, styles.yLabel, { top: yAt(tick) - 8 }]} numberOfLines={1}>
                        {model.formatTick(tick)}
                    </Text>
                ))}
                {model.ticks.map((tick) => {
                    // Centred under its tick, but kept inside the card at both ends. Text cannot be
                    // measured before it is laid out, so its width is estimated, on the generous side.
                    const labelWidth = tick.label.length * 7 + 6;
                    const left = Math.max(Y_AXIS_WIDTH - 12, Math.min(xAt(tick.pos) - labelWidth / 2, width - labelWidth));
                    return (
                        <Text key={tick.pos} style={[styles.label, styles.xLabel, { left, width: labelWidth }]} numberOfLines={1}>
                            {tick.label}
                        </Text>
                    );
                })}
            </View>
        </GestureDetector>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        label: {
            position: "absolute",
            fontSize: fontSize.xxs,
            lineHeight: 16,
            color: colors.textSecondary,
            fontVariant: ["tabular-nums"],
        },
        yLabel: { left: 0, width: Y_AXIS_WIDTH - 8, textAlign: "right" },
        xLabel: { top: TOP + PLOT_HEIGHT + 7, textAlign: "center" },
    });
}
