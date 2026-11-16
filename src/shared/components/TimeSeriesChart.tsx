import Card from "@/src/shared/atoms/Card";
import EmptyState from "@/src/shared/atoms/EmptyState";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import ChartHeadline from "./ChartHeadline";
import TimeSeriesPlot, { PLOT_INSET, type TimeSeriesModel } from "./TimeSeriesPlot";

interface TimeSeriesChartProps {
    /**
     * What to draw on a time axis `plotWidth` wide, or null when there is
     * nothing to draw. Called again whenever it changes, so memoize it
     * (`useCallback`) on the data it reads.
     */
    build: (plotWidth: number) => TimeSeriesModel | null;
    /** What the chart shows, for screen readers. */
    title: string;
    /** Shown in place of the plot when `build` returns null. */
    emptyTitle: string;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one chart of a value over time: a card with the figures on top, the
 * plot under them and a key where the plot needs one. Touching the plot
 * switches the figures from the whole range to the touched day.
 */
export default function TimeSeriesChart({ build, title, emptyTitle, loading = false, style }: TimeSeriesChartProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [width, setWidth] = useState(0);

    const model = useMemo(() => (width > PLOT_INSET ? build(width - PLOT_INSET) : null), [build, width]);

    // A selection belongs to the chart it was made on: any new model starts without one.
    const [selection, setSelection] = useState<{ model: TimeSeriesModel; index: number } | null>(null);
    const selected = model && selection?.model === model ? selection.index : null;
    const handleSelect = useCallback(
        (index: number | null) => setSelection(index == null || !model ? null : { model, index }),
        [model],
    );

    const summary = model?.headline(null);

    return (
        <Card style={style}>
            <View style={styles.content} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {loading || width === 0 ? (
                    loading && <ActivityIndicator style={styles.placeholder} color={colors.textSecondary} />
                ) : !model || !summary ? (
                    <EmptyState icon="analytics-outline" title={emptyTitle} style={styles.placeholder} />
                ) : (
                    <>
                        <ChartHeadline headline={model.headline(selected)} />
                        <View style={styles.plot}>
                            <TimeSeriesPlot
                                model={model}
                                width={width}
                                selected={selected}
                                onSelect={handleSelect}
                                accessibilityLabel={[
                                    title,
                                    summary.caption,
                                    [summary.value, summary.unit].filter(Boolean).join(" "),
                                    summary.aside,
                                    ...(summary.tiles ?? []).map((tile) => `${tile.label} ${tile.value}`),
                                ].filter(Boolean).join(", ")}
                            />
                        </View>
                        {model.legend && (
                            <View style={styles.legend}>
                                {model.legend.map((item) => (
                                    <View key={item.label} style={styles.legendItem}>
                                        <View style={[item.mark === "dot" ? styles.dot : styles.line, { backgroundColor: item.color }]} />
                                        <Text style={styles.legendText}>{item.label}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </View>
        </Card>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        content: { minHeight: 240, justifyContent: "center" },
        placeholder: { paddingVertical: spacing.xl },
        plot: { marginTop: spacing.md },
        legend: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: spacing.xs, marginTop: spacing.sm },
        legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
        dot: { width: 7, height: 7, borderRadius: borderRadius.full, opacity: 0.5 },
        line: { width: 14, height: 2, borderRadius: borderRadius.full },
        legendText: { fontSize: fontSize.xs, color: colors.textSecondary },
    });
}
