import { type DailyTotals, formatDateKey, getDailyTotalsForRange } from "@/src/db/queries";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LineChart } from "react-native-gifted-charts";

// ── Types ──────────────────────────────────────────────────

type TimeSpan = 7 | 14 | 30 | 90 | 365 | "all";
type Metric = "calories" | "macros" | "carbs" | "protein" | "fat";
type MacroKey = "protein" | "carbs" | "fat";

const TIME_SPANS: { key: TimeSpan; labelKey: string }[] = [
    { key: 7, labelKey: "analytics.week" },
    { key: 14, labelKey: "analytics.twoWeeks" },
    { key: 30, labelKey: "analytics.month" },
    { key: 90, labelKey: "analytics.threeMonths" },
    { key: 365, labelKey: "analytics.year" },
    { key: "all", labelKey: "analytics.all" },
];

const METRICS: { key: Metric; labelKey: string }[] = [
    { key: "calories", labelKey: "analytics.calories" },
    { key: "macros", labelKey: "analytics.macros" },
    { key: "carbs", labelKey: "analytics.carbs" },
    { key: "protein", labelKey: "analytics.protein" },
    { key: "fat", labelKey: "analytics.fat" },
];

// ── Helpers ────────────────────────────────────────────────

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDateKey(d);
}

function computeStats(values: number[]) {
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const first = values[0];
    const last = values[values.length - 1];
    const trend = last > first ? "up" : last < first ? "down" : "flat";
    return { min, max, avg, stdDev, variance, trend };
}

const MACRO_KCAL: Record<MacroKey, number> = { protein: 4, carbs: 4, fat: 9 };

function formatNum(v: number, decimals = 1): string {
    return v.toFixed(decimals);
}

// ── Component ──────────────────────────────────────────────

export default function AnalyticsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [timeSpan, setTimeSpan] = useState<TimeSpan>(30);
    const [metric, setMetric] = useState<Metric>("calories");
    const [statsOpen, setStatsOpen] = useState(false);
    const [selectedMacro, setSelectedMacro] = useState<MacroKey>("protein");

    // ── Data ───────────────────────────────────────────────

    const data = useMemo(() => {
        const endDate = formatDateKey(new Date());
        const startDate = timeSpan === "all" ? "2000-01-01" : daysAgo(timeSpan);
        return getDailyTotalsForRange(startDate, endDate);
    }, [timeSpan]);

    // ── Chart data ─────────────────────────────────────────

    // Available width for the chart area inside the card (card has padding + border)
    const screenWidth = Dimensions.get("window").width;
    const chartContainerPadding = spacing.md * 2 + spacing.md * 2 + 2; // scrollContent padding + chartWrapper padding + borders
    const yAxisLabelWidth = 45;
    const secondaryAxisWidth = 45;

    const shouldScroll = typeof timeSpan === "number" && timeSpan >= 90 || timeSpan === "all";

    const chartConfig = useMemo(() => {
        if (data.length === 0) return null;

        const formatLabel = (d: DailyTotals) => {
            const parts = d.date.split("-");
            return `${parts[2]}/${parts[1]}`;
        };

        // Compute sensible label count: aim for ~5-7 visible labels
        const targetLabelCount = Math.min(data.length, 7);
        const labelInterval = Math.max(1, Math.floor(data.length / targetLabelCount));
        // For very small sets, label every point
        const actualInterval = data.length <= 7 ? 1 : labelInterval;

        const makeLabelProps = (d: DailyTotals, i: number) => ({
            label: i % actualInterval === 0 ? formatLabel(d) : "",
            labelTextStyle: { color: colors.textSecondary, fontSize: 9 } as const,
        });

        if (metric === "calories") {
            // True stacked area: fat (bottom) → carbs → protein → calories line on top
            // Each layer's value = cumulative sum up to that layer
            const fatData = data.map((d, i) => ({
                value: d.fat * MACRO_KCAL.fat,
                ...makeLabelProps(d, i),
            }));
            const carbsData = data.map((d) => ({
                value: d.fat * MACRO_KCAL.fat + d.carbs * MACRO_KCAL.carbs,
            }));
            const proteinData = data.map((d) => ({
                value: d.fat * MACRO_KCAL.fat + d.carbs * MACRO_KCAL.carbs + d.protein * MACRO_KCAL.protein,
            }));
            // Calories line sits at the stacked top — same value as the protein stack
            // (the macro calories already total up to ~total calories)
            // We use the actual calories value so discrepancies between total and macro sum show
            const caloriesData = data.map((d) => ({
                value: d.calories,
            }));

            return {
                type: "calories" as const,
                fatData,
                carbsData,
                proteinData,
                caloriesData,
            };
        }

        if (metric === "macros") {
            // 100% stacked: each macro as % of total macro calories
            const normalised = data.map((d, i) => {
                const totalMacroCal =
                    d.protein * MACRO_KCAL.protein +
                    d.carbs * MACRO_KCAL.carbs +
                    d.fat * MACRO_KCAL.fat;
                const pPct = totalMacroCal > 0 ? (d.protein * MACRO_KCAL.protein / totalMacroCal) * 100 : 0;
                const cPct = totalMacroCal > 0 ? (d.carbs * MACRO_KCAL.carbs / totalMacroCal) * 100 : 0;
                const fPct = totalMacroCal > 0 ? (d.fat * MACRO_KCAL.fat / totalMacroCal) * 100 : 0;
                return { ...makeLabelProps(d, i), pPct, cPct, fPct };
            });

            // Stack: fat on bottom, then carbs, then protein on top
            const fatData = normalised.map((d) => ({
                value: d.fPct,
                label: d.label,
                labelTextStyle: d.labelTextStyle,
            }));
            const carbsData = normalised.map((d) => ({
                value: d.fPct + d.cPct,
            }));
            const proteinData = normalised.map((d) => ({
                value: d.fPct + d.cPct + d.pPct,
            }));

            return {
                type: "macros" as const,
                proteinData,
                carbsData,
                fatData,
            };
        }

        // Single macro: simple area with grams + secondary axis in kcal
        const macroKey = metric as MacroKey;
        const kcalFactor = MACRO_KCAL[macroKey];
        const mainData = data.map((d, i) => ({
            value: d[macroKey],
            ...makeLabelProps(d, i),
        }));
        // Secondary data for the right-side kcal axis
        const secondaryData = data.map((d) => ({
            value: d[macroKey] * kcalFactor,
        }));

        // Compute max for secondary axis alignment
        const maxGrams = Math.max(...data.map((d) => d[macroKey]), 1);
        const maxKcal = maxGrams * kcalFactor;

        return {
            type: "single" as const,
            macroKey,
            mainData,
            secondaryData,
            maxKcal,
        };
    }, [data, metric, colors]);

    // ── Statistics ──────────────────────────────────────────

    const stats = useMemo(() => {
        if (data.length === 0) return null;

        if (metric === "calories") {
            return computeStats(data.map((d) => d.calories));
        }
        if (metric === "macros") {
            return computeStats(data.map((d) => d[selectedMacro]));
        }
        const macroKey = metric as MacroKey;
        return computeStats(data.map((d) => d[macroKey]));
    }, [data, metric, selectedMacro]);

    const statsUnit = metric === "calories" ? t("common.kcal") : t("common.g");
    const statsLabel =
        metric === "macros" ? t(`analytics.${selectedMacro}`) : t(`analytics.${metric}`);

    // ── Macro area press for macros chart ──────────────────

    const handleMacroSelect = useCallback((macro: MacroKey) => {
        setSelectedMacro(macro);
    }, []);

    // ── Render ─────────────────────────────────────────────

    // For non-scrollable charts, compute spacing so data fills exactly the available width
    const hasSecondaryAxis = chartConfig?.type === "single";
    const availableChartWidth = screenWidth - chartContainerPadding - yAxisLabelWidth - (hasSecondaryAxis ? secondaryAxisWidth : 0);
    const computedSpacing = data.length > 1 ? availableChartWidth / (data.length - 1) : availableChartWidth;
    // For scrollable charts, use a comfortable fixed spacing
    const scrollSpacing = 8;
    const chartSpacing = shouldScroll ? scrollSpacing : computedSpacing;
    // Width prop: for scrollable, let it extend; for non-scrollable, match available width exactly
    const chartWidthProp = shouldScroll ? undefined : availableChartWidth;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.title}>{t("analytics.title")}</Text>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Time Span Selector */}
                <Text style={styles.sectionLabel}>{t("analytics.timeSpan")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {TIME_SPANS.map((ts) => (
                        <Pressable
                            key={String(ts.key)}
                            style={[styles.chip, timeSpan === ts.key && styles.chipActive]}
                            onPress={() => setTimeSpan(ts.key)}
                        >
                            <Text style={[styles.chipText, timeSpan === ts.key && styles.chipTextActive]}>
                                {t(ts.labelKey)}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Metric Selector */}
                <Text style={styles.sectionLabel}>{t("analytics.metric")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {METRICS.map((m) => (
                        <Pressable
                            key={m.key}
                            style={[styles.chip, metric === m.key && styles.chipActive]}
                            onPress={() => setMetric(m.key)}
                        >
                            <Text style={[styles.chipText, metric === m.key && styles.chipTextActive]}>
                                {t(m.labelKey)}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Macro sub-selector for macros view */}
                {metric === "macros" && (
                    <View style={styles.macroSubRow}>
                        {(["protein", "carbs", "fat"] as MacroKey[]).map((m) => (
                            <Pressable
                                key={m}
                                style={[
                                    styles.macroChip,
                                    { borderColor: colors[m] },
                                    selectedMacro === m && { backgroundColor: colors[m] },
                                ]}
                                onPress={() => handleMacroSelect(m)}
                            >
                                <Text
                                    style={[
                                        styles.macroChipText,
                                        { color: selectedMacro === m ? "#fff" : colors[m] },
                                    ]}
                                >
                                    {t(`analytics.${m}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* Statistics Section */}
                {stats && (
                    <Pressable
                        style={styles.statsContainer}
                        onPress={() => setStatsOpen((o) => !o)}
                    >
                        <View style={styles.statsHeader}>
                            <Text style={styles.statsTitle}>{t("analytics.statistics")}</Text>
                            <Ionicons
                                name={statsOpen ? "chevron-up" : "chevron-down"}
                                size={18}
                                color={colors.textSecondary}
                            />
                        </View>

                        {/* Always-visible summary */}
                        <View style={styles.statsRow}>
                            <StatCell label={t("analytics.min")} value={`${formatNum(stats.min)} ${statsUnit}`} colors={colors} />
                            <StatCell label={t("analytics.avg")} value={`${formatNum(stats.avg)} ${statsUnit}`} colors={colors} />
                            <StatCell label={t("analytics.max")} value={`${formatNum(stats.max)} ${statsUnit}`} colors={colors} />
                        </View>

                        {/* Expanded details */}
                        {statsOpen && (
                            <>
                                <View style={styles.statsRow}>
                                    <StatCell label={t("analytics.stdDev")} value={`${formatNum(stats.stdDev)} ${statsUnit}`} colors={colors} />
                                    <StatCell label={t("analytics.variance")} value={formatNum(stats.variance, 0)} colors={colors} />
                                    <StatCell
                                        label={t("analytics.trend")}
                                        value={t(`analytics.trend${stats.trend.charAt(0).toUpperCase() + stats.trend.slice(1)}` as any)}
                                        colors={colors}
                                    />
                                </View>
                                <Text style={styles.statsNote}>
                                    {statsLabel}
                                </Text>
                            </>
                        )}
                    </Pressable>
                )}

                {/* Chart */}
                {data.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>{t("analytics.noData")}</Text>
                    </View>
                ) : (
                    <View style={styles.chartWrapper}>
                        {chartConfig?.type === "calories" && (
                            <LineChart
                                data={chartConfig.fatData}
                                data2={chartConfig.carbsData}
                                data3={chartConfig.proteinData}
                                data4={chartConfig.caloriesData}
                                width={chartWidthProp}
                                height={220}
                                spacing={chartSpacing}
                                initialSpacing={0}
                                endSpacing={0}
                                disableScroll={!shouldScroll}
                                scrollToEnd={shouldScroll}
                                color1={colors.fat}
                                color2={colors.carbs}
                                color3={colors.protein}
                                color4={colors.calories}
                                startFillColor1={colors.fat}
                                startFillColor2={colors.carbs}
                                startFillColor3={colors.protein}
                                startFillColor4={"transparent"}
                                endFillColor1={colors.fat}
                                endFillColor2={colors.carbs}
                                endFillColor3={colors.protein}
                                endFillColor4={"transparent"}
                                startOpacity1={0.7}
                                startOpacity2={0.7}
                                startOpacity3={0.7}
                                startOpacity4={0}
                                endOpacity1={0.7}
                                endOpacity2={0.7}
                                endOpacity3={0.7}
                                endOpacity4={0}
                                noOfSections={5}
                                yAxisColor={colors.border}
                                xAxisColor={colors.border}
                                yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                                yAxisLabelSuffix=" kcal"
                                rulesColor={colors.border + "66"}
                                curved
                                areaChart
                                hideDataPoints
                                isAnimated
                                animationDuration={600}
                                thickness1={1.5}
                                thickness2={1.5}
                                thickness3={1.5}
                                thickness4={2}
                            />
                        )}
                        {chartConfig?.type === "macros" && (
                            <LineChart
                                data={chartConfig.proteinData}
                                data2={chartConfig.carbsData}
                                data3={chartConfig.fatData}
                                width={chartWidthProp}
                                height={220}
                                spacing={chartSpacing}
                                initialSpacing={0}
                                endSpacing={0}
                                disableScroll={!shouldScroll}
                                scrollToEnd={shouldScroll}
                                color1={colors.protein}
                                color2={colors.carbs}
                                color3={colors.fat}
                                startFillColor1={colors.protein}
                                startFillColor2={colors.carbs}
                                startFillColor3={colors.fat}
                                endFillColor1={colors.protein}
                                endFillColor2={colors.carbs}
                                endFillColor3={colors.fat}
                                startOpacity1={0.7}
                                startOpacity2={0.7}
                                startOpacity3={0.7}
                                endOpacity1={0.7}
                                endOpacity2={0.7}
                                endOpacity3={0.7}
                                noOfSections={5}
                                maxValue={100}
                                yAxisColor={colors.border}
                                xAxisColor={colors.border}
                                yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                                yAxisLabelSuffix="%"
                                rulesColor={colors.border + "66"}
                                curved
                                areaChart
                                hideDataPoints
                                isAnimated
                                animationDuration={600}
                            />
                        )}
                        {chartConfig?.type === "single" && (
                            <LineChart
                                data={chartConfig.mainData}
                                secondaryData={chartConfig.secondaryData}
                                secondaryYAxis={{
                                    maxValue: chartConfig.maxKcal,
                                    noOfSections: 5,
                                    yAxisColor: colors.border,
                                    yAxisTextStyle: { color: colors.textSecondary, fontSize: 10 },
                                    yAxisLabelSuffix: " kcal",
                                }}
                                secondaryLineConfig={{
                                    color: "transparent",
                                }}
                                width={chartWidthProp}
                                height={220}
                                spacing={chartSpacing}
                                initialSpacing={0}
                                endSpacing={0}
                                disableScroll={!shouldScroll}
                                scrollToEnd={shouldScroll}
                                color1={colors[chartConfig.macroKey]}
                                startFillColor1={colors[chartConfig.macroKey]}
                                endFillColor1={colors[chartConfig.macroKey] + "22"}
                                startOpacity1={0.4}
                                endOpacity1={0.05}
                                noOfSections={5}
                                yAxisColor={colors.border}
                                xAxisColor={colors.border}
                                yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                                yAxisLabelSuffix=" g"
                                rulesColor={colors.border + "66"}
                                curved
                                areaChart
                                hideDataPoints
                                isAnimated
                                animationDuration={600}
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
                )}
            </ScrollView>
        </View>
    );
}

// ── Sub-components ─────────────────────────────────────────

function StatCell({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
    return (
        <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>{label}</Text>
            <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: "600", marginTop: 2 }}>
                {value}
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

// ── Styles ─────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        title: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
        },
        scroll: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.xl,
        },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            marginTop: spacing.md,
            marginBottom: spacing.xs,
            letterSpacing: 0.5,
        },
        chipRow: {
            flexDirection: "row",
            marginBottom: spacing.xs,
        },
        chip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            marginRight: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
        },
        chipActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        chipText: {
            fontSize: fontSize.sm,
            color: colors.text,
            fontWeight: "500",
        },
        chipTextActive: {
            color: "#fff",
        },
        macroSubRow: {
            flexDirection: "row",
            marginTop: spacing.sm,
            marginBottom: spacing.xs,
            gap: spacing.sm,
        },
        macroChip: {
            flex: 1,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            borderWidth: 1.5,
            alignItems: "center",
        },
        macroChipText: {
            fontWeight: "600",
            fontSize: fontSize.sm,
        },
        statsContainer: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        statsHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.sm,
        },
        statsTitle: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
        },
        statsRow: {
            flexDirection: "row",
            marginBottom: spacing.sm,
        },
        statsNote: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            textAlign: "center",
            marginTop: spacing.xs,
        },
        chartWrapper: {
            marginTop: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        legend: {
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: spacing.md,
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
