import type { WeightLog } from "@/src/features/log/services/logDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import logger from "@/src/utils/logger";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import {
    ANIMATION_DURATION,
    CURVATURE,
    END_OPACITY,
    END_SHADE,
    GRAPH_HEIGHT,
    MACRO_KCAL,
    START_OPACITY,
    START_SHADE,
    formatLabel,
    shadeColor,
    type MacroKey,
    type Metric,
    type TimeSpan,
} from "../helpers/analyticsHelpers";
import type { DailyTotals } from "../services/analyticsDb";

// ── Label helpers ──────────────────────────────────────────

function LabelItem({ label }: { color: string; label: string }) {
    const colors = useThemeColors();
    return (
        <View style={{ width: 40 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 9, textAlign: "center" }} allowFontScaling>
                {label}
            </Text>
        </View>
    );
}

function LegendItem({ color, label }: { color: string; label: string }) {
    const colors = useThemeColors();
    return (
        <View style={{ flexDirection: "row", alignItems: "center", marginRight: spacing.md }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 4 }} />
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>{label}</Text>
        </View>
    );
}

function makeLabelProps(date: string, timespan: TimeSpan, colors: ThemeColors) {
    const val = formatLabel(date);
    let shouldShowLabel;
    switch (timespan) {
        case 7:
            shouldShowLabel = true;
            break;
        case 14:
            shouldShowLabel = parseInt(date.slice(-1)) % 2 === 0;
            break;
        default:
            shouldShowLabel = date.endsWith("-01") || date.endsWith("-11") || date.endsWith("-21");
    }
    return {
        showStrip: shouldShowLabel,
        stripHeight: GRAPH_HEIGHT + 20,
        stripColor: colors.border + "66",
        labelComponent: shouldShowLabel ? () => <LabelItem color={colors.textSecondary} label={val} /> : undefined,
    };
}

// ── Shared chart props builder ─────────────────────────────

function baseChartProps(
    chartWidthProp: number,
    chartSpacing: number,
    shouldScroll: boolean,
    colors: ThemeColors,
) {
    return {
        width: chartWidthProp,
        height: 220,
        spacing: chartSpacing,
        initialSpacing: 0,
        endSpacing: 0,
        disableScroll: !shouldScroll,
        scrollToEnd: shouldScroll,
        noOfSections: 5,
        yAxisColor: colors.border,
        xAxisColor: colors.border,
        yAxisTextStyle: { color: colors.textSecondary, fontSize: 10 },
        rulesColor: colors.border + "66",
        curved: true,
        curvature: CURVATURE,
        areaChart: true,
        hideDataPoints: true,
        isAnimated: ANIMATION_DURATION > 0,
        animationDuration: ANIMATION_DURATION,
        labelsExtraHeight: 6,
        xAxisLabelsHeight: 20,
    } as const;
}

// ── Component ──────────────────────────────────────────────

interface AnalyticsChartProps {
    data: DailyTotals[];
    weightData: WeightLog[];
    metric: Metric;
    timeSpan: TimeSpan;
    isImperial: boolean;
    KG_TO_LB: number;
    chartWidthProp: number;
    chartSpacing: number;
    shouldScroll: boolean;
    loading: boolean;
}

export default function AnalyticsChart({
    data, weightData, metric, timeSpan, isImperial, KG_TO_LB,
    chartWidthProp, chartSpacing, shouldScroll, loading,
}: AnalyticsChartProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const shared = baseChartProps(chartWidthProp, chartSpacing, shouldScroll, colors);

    const chartConfig = useMemo(() => {
        if (data.length === 0) return null;

        if (metric === "calories") {
            const normalized = data.map((d) => {
                const macroCal = d.fat * MACRO_KCAL.fat + d.carbs * MACRO_KCAL.carbs + d.protein * MACRO_KCAL.protein;
                const factor = macroCal > 0 ? d.calories / macroCal : 1;
                return { ...d, fat: d.fat * factor, carbs: d.carbs * factor, protein: d.protein * factor };
            });
            return {
                type: "calories" as const,
                fatData: normalized.map((d) => ({ value: d.fat * MACRO_KCAL.fat })),
                carbsData: normalized.map((d) => ({ value: d.fat * MACRO_KCAL.fat + d.carbs * MACRO_KCAL.carbs })),
                proteinData: normalized.map((d, _i) => ({
                    value: d.calories,
                    ...makeLabelProps(d.date, timeSpan, colors),
                })),
            };
        }

        if (metric === "macros") {
            const normalised = data.map((d) => {
                let totalMacroCal = d.protein * MACRO_KCAL.protein + d.carbs * MACRO_KCAL.carbs + d.fat * MACRO_KCAL.fat;
                totalMacroCal = totalMacroCal > 0 ? totalMacroCal : 1;
                return {
                    ...makeLabelProps(d.date, timeSpan, colors),
                    pPct: (d.protein * MACRO_KCAL.protein / totalMacroCal) * 100,
                    cPct: (d.carbs * MACRO_KCAL.carbs / totalMacroCal) * 100,
                    fPct: (d.fat * MACRO_KCAL.fat / totalMacroCal) * 100,
                };
            });
            return {
                type: "macros" as const,
                fatData: normalised.map((d) => ({ value: d.fPct })),
                carbsData: normalised.map((d) => ({ value: d.fPct + d.cPct })),
                proteinData: normalised.map((d) => ({ value: 100, labelComponent: d.labelComponent })),
            };
        }

        if (metric === "carbs" || metric === "protein" || metric === "fat") {
            const macroKey = metric as MacroKey;
            const kcalFactor = MACRO_KCAL[macroKey];
            const maxKcal = Math.max(...data.map((d) => d[macroKey]), 1) * kcalFactor;
            return {
                type: "single" as const,
                macroKey,
                mainData: data.map((d) => ({ value: d[macroKey], ...makeLabelProps(d.date, timeSpan, colors) })),
                secondaryData: data.map((d) => ({ value: d[macroKey] * kcalFactor })),
                maxKcal,
            };
        }

        if (metric === "weight") {
            const byDate = new Map<string, number[]>();
            for (const w of weightData) {
                const arr = byDate.get(w.date) ?? [];
                arr.push(w.weight_kg);
                byDate.set(w.date, arr);
            }
            const dailyAvg = Array.from(byDate.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, vals]) => ({ date, avg: vals.reduce((a, b) => a + b, 0) / vals.length }));
            if (dailyAvg.length === 0) return null;

            const cf = isImperial ? KG_TO_LB : 1;
            const weightValues = dailyAvg.map((d) => d.avg * cf);
            const minW = Math.min(...weightValues);
            const maxW = Math.max(...weightValues);
            const range = maxW - minW;
            const padding = range > 0 ? Math.min(minW, 0.1 * range) : minW * 0.01 || 1;
            return {
                type: "weight" as const,
                weightPoints: dailyAvg.map((d) => ({ value: d.avg * cf, ...makeLabelProps(d.date, timeSpan, colors) })),
                yAxisOffset: Math.max(0, Math.floor(minW - padding)),
            };
        }

        logger.warn("[UI] Unknown metric type for analytics chart", { metric });
        return null;
    }, [data, weightData, metric, colors, isImperial]);

    if (loading) {
        return (
            <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!chartConfig) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>{t("analytics.noData")}</Text>
            </View>
        );
    }

    return (
        <View style={styles.chartWrapper}>
            {chartConfig.type === "calories" && (
                <LineChart
                    key={`calories-${timeSpan}`}
                    data={chartConfig.proteinData}
                    data2={chartConfig.carbsData}
                    data3={chartConfig.fatData}
                    color1={colors.calories}
                    color2={colors.carbs}
                    color3={colors.fat}
                    startFillColor1={shadeColor(colors.protein, START_SHADE)}
                    startFillColor2={shadeColor(colors.carbs, START_SHADE)}
                    startFillColor3={shadeColor(colors.fat, START_SHADE)}
                    endFillColor1={shadeColor(colors.protein, END_SHADE)}
                    endFillColor2={shadeColor(colors.carbs, END_SHADE)}
                    endFillColor3={shadeColor(colors.fat, END_SHADE)}
                    startOpacity1={START_OPACITY}
                    startOpacity2={START_OPACITY}
                    startOpacity3={START_OPACITY}
                    endOpacity1={END_OPACITY}
                    endOpacity2={END_OPACITY}
                    endOpacity3={END_OPACITY}
                    thickness1={2}
                    thickness2={1.5}
                    thickness3={1.5}
                    thickness4={1.5}
                    yAxisLabelSuffix=""
                    {...shared}
                />
            )}
            {chartConfig.type === "macros" && (
                <LineChart
                    key={`macros-${timeSpan}`}
                    data={chartConfig.proteinData}
                    data2={chartConfig.carbsData}
                    data3={chartConfig.fatData}
                    color1={colors.protein}
                    color2={colors.carbs}
                    color3={colors.fat}
                    startFillColor1={shadeColor(colors.protein, START_SHADE)}
                    startFillColor2={shadeColor(colors.carbs, START_SHADE)}
                    startFillColor3={shadeColor(colors.fat, START_SHADE)}
                    endFillColor1={shadeColor(colors.protein, END_SHADE)}
                    endFillColor2={shadeColor(colors.carbs, END_SHADE)}
                    endFillColor3={shadeColor(colors.fat, END_SHADE)}
                    startOpacity1={START_OPACITY}
                    startOpacity2={START_OPACITY}
                    startOpacity3={START_OPACITY}
                    endOpacity1={END_OPACITY}
                    endOpacity2={END_OPACITY}
                    endOpacity3={END_OPACITY}
                    stripOverDataPoints
                    stripOpacity={1}
                    yAxisLabelSuffix="%"
                    maxValue={100}
                    {...shared}
                />
            )}
            {chartConfig.type === "single" && (
                <LineChart
                    key={`single-${timeSpan}`}
                    data={chartConfig.mainData}
                    secondaryData={chartConfig.secondaryData}
                    secondaryYAxis={{
                        maxValue: chartConfig.maxKcal,
                        yAxisColor: colors.border,
                        yAxisTextStyle: { color: colors.textSecondary, fontSize: 10 },
                        yAxisLabelSuffix: "",
                    }}
                    secondaryLineConfig={{ color: "transparent" }}
                    color1={colors[chartConfig.macroKey]}
                    startFillColor1={shadeColor(colors[chartConfig.macroKey], START_SHADE)}
                    endFillColor1={shadeColor(colors[chartConfig.macroKey], END_SHADE)}
                    startOpacity1={START_OPACITY}
                    endOpacity1={END_OPACITY}
                    yAxisLabelSuffix=" g"
                    {...shared}
                />
            )}
            {chartConfig.type === "weight" && (
                <LineChart
                    key={`weight-${timeSpan}`}
                    data={chartConfig.weightPoints}
                    color1={colors.weight}
                    startFillColor1={shadeColor(colors.weight, START_SHADE)}
                    endFillColor1={shadeColor(colors.weight, END_SHADE)}
                    startOpacity1={START_OPACITY}
                    endOpacity1={END_OPACITY}
                    yAxisLabelSuffix={isImperial ? " lb" : " kg"}
                    yAxisOffset={chartConfig.yAxisOffset}
                    {...shared}
                />
            )}

            {/* Legend */}
            <View style={styles.legend}>
                {metric === "calories" && (
                    <>
                        <LegendItem color={colors.calories} label={t("analytics.calories")} />
                        <LegendItem color={colors.protein} label={t("analytics.protein")} />
                        <LegendItem color={colors.carbs} label={t("analytics.carbs")} />
                        <LegendItem color={colors.fat} label={t("analytics.fat")} />
                    </>
                )}
                {metric === "macros" && (
                    <>
                        <LegendItem color={colors.protein} label={t("analytics.protein")} />
                        <LegendItem color={colors.carbs} label={t("analytics.carbs")} />
                        <LegendItem color={colors.fat} label={t("analytics.fat")} />
                    </>
                )}
                {metric !== "calories" && metric !== "macros" && (
                    <LegendItem color={colors[metric]} label={t(`analytics.${metric}`)} />
                )}
            </View>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        chartWrapper: {
            marginTop: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        legend: {
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
        },
        emptyContainer: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.xl * 2,
        },
        emptyText: {
            color: colors.textTertiary,
            fontSize: fontSize.md,
            marginTop: spacing.md,
        },
    });
}
