import type { WeightLog } from "@/src/features/log/services/logDb";
import type { NutritionGoals } from "@/src/features/settings/services/settingsDb";
import Card from "@/src/shared/atoms/Card";
import EmptyState from "@/src/shared/atoms/EmptyState";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { KG_TO_LB, type Metric } from "../helpers/analyticsHelpers";
import { buildChartModel, type ChartModel, type ChartRange } from "../helpers/chartModel";
import type { DailyTotals } from "../services/analyticsDb";
import ChartHeadline from "./ChartHeadline";
import TrendPlot, { PLOT_INSET } from "./TrendPlot";

interface AnalyticsChartProps {
    metric: Metric;
    /** The days on the time axis; null when there is nothing to put on it. */
    range: ChartRange | null;
    data: DailyTotals[];
    /** May reach back before the range, for the trend. */
    weightLogs: WeightLog[];
    goals: NutritionGoals | undefined;
    goalHistory: (NutritionGoals & { date: string })[];
    isImperial: boolean;
    loading: boolean;
}

/** The chart card: figures on top, the plot under them, and a key where the plot needs one. */
export default function AnalyticsChart({
    metric, range, data, weightLogs, goals, goalHistory, isImperial, loading,
}: AnalyticsChartProps) {
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [width, setWidth] = useState(0);

    const model = useMemo(() => {
        if (!range || width <= PLOT_INSET) return null;
        return buildChartModel({
            metric, range, data, weightLogs, goals, goalHistory,
            weightUnit: isImperial ? "lb" : "kg",
            weightFactor: isImperial ? KG_TO_LB : 1,
            plotWidth: width - PLOT_INSET,
            colors,
            locale: i18n.language,
            t,
        });
    }, [metric, range, data, weightLogs, goals, goalHistory, isImperial, width, colors, i18n.language, t]);

    // A selection belongs to the chart it was made on: any new model starts without one.
    const [selection, setSelection] = useState<{ model: ChartModel; index: number } | null>(null);
    const selected = model && selection?.model === model ? selection.index : null;
    const handleSelect = useCallback(
        (index: number | null) => setSelection(index == null || !model ? null : { model, index }),
        [model],
    );

    const headline = model?.headline(selected);
    const summary = model?.headline(null);

    return (
        <Card>
            <View style={styles.content} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {loading || width === 0 ? (
                    loading && <ActivityIndicator style={styles.placeholder} color={colors.textSecondary} />
                ) : !model || !range || !headline || !summary ? (
                    <EmptyState icon="analytics-outline" title={t("analytics.noData")} style={styles.placeholder} />
                ) : (
                    <>
                        <ChartHeadline headline={headline} />
                        <View style={styles.plot}>
                            <TrendPlot
                                model={model}
                                width={width}
                                days={range.days}
                                selected={selected}
                                onSelect={handleSelect}
                                accessibilityLabel={[
                                    t(`analytics.${metric}`),
                                    summary.caption,
                                    [summary.value, summary.unit].filter(Boolean).join(" "),
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
