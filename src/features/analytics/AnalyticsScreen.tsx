import { type DailyTotals, formatDateKey, getDailyTotalsForRange } from "@/src/db/queries";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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

    const chartConfig = useMemo(() => {
        if (data.length === 0) return null;

        const formatLabel = (d: DailyTotals) => {
            const parts = d.date.split("-");
            return `${parts[2]}/${parts[1]}`;
        };

        // Show fewer labels for large datasets
        const labelInterval = data.length > 60 ? Math.ceil(data.length / 8) :
            data.length > 14 ? Math.ceil(data.length / 7) : 1;

        if (metric === "calories") {
            // Stacked: macros as calories on top, total calories line
            const mainData = data.map((d, i) => ({
                value: d.calories,
                label: i % labelInterval === 0 ? formatLabel(d) : "",
                labelTextStyle: { color: colors.textSecondary, fontSize: 9 },
            }));

            const proteinData = data.map((d) => ({
                value: d.protein * MACRO_KCAL.protein,
            }));
            const carbsData = data.map((d) => ({
                value: d.carbs * MACRO_KCAL.carbs,
            }));
            const fatData = data.map((d) => ({
                value: d.fat * MACRO_KCAL.fat,
            }));

            return {
                type: "calories" as const,
                mainData,
                proteinData,
                carbsData,
                fatData,
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
                return {
                    label: i % labelInterval === 0 ? formatLabel(d) : "",
                    labelTextStyle: { color: colors.textSecondary, fontSize: 9 },
                    pPct,
                    cPct,
                    fPct,
                };
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

        // Single macro: simple area with grams
        const macroKey = metric as MacroKey;
        const mainData = data.map((d, i) => ({
            value: d[macroKey],
            label: i % labelInterval === 0 ? formatLabel(d) : "",
            labelTextStyle: { color: colors.textSecondary, fontSize: 9 },
        }));

        return {
            type: "single" as const,
            macroKey,
            mainData,
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

    const chartWidth = 300;

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
                                data={chartConfig.mainData}
                                data2={chartConfig.proteinData}
                                data3={chartConfig.carbsData}
                                data4={chartConfig.fatData}
                                width={chartWidth}
                                height={220}
                                spacing={data.length > 30 ? Math.max(6, chartWidth / data.length) : chartWidth / data.length}
                                color1={colors.calories}
                                color2={colors.protein}
                                color3={colors.carbs}
                                color4={colors.fat}
                                startFillColor1={colors.calories}
                                startFillColor2={colors.protein}
                                startFillColor3={colors.carbs}
                                startFillColor4={colors.fat}
                                endFillColor1={colors.calories + "33"}
                                endFillColor2={colors.protein + "33"}
                                endFillColor3={colors.carbs + "33"}
                                endFillColor4={colors.fat + "33"}
                                startOpacity1={0.4}
                                startOpacity2={0.3}
                                startOpacity3={0.3}
                                startOpacity4={0.3}
                                endOpacity1={0.05}
                                endOpacity2={0.05}
                                endOpacity3={0.05}
                                endOpacity4={0.05}
                                noOfSections={5}
                                yAxisColor={colors.border}
                                xAxisColor={colors.border}
                                yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                                rulesColor={colors.border + "66"}
                                curved
                                areaChart
                                hideDataPoints
                                isAnimated
                                animationDuration={600}
                                scrollToEnd
                            />
                        )}
                        {chartConfig?.type === "macros" && (
                            <LineChart
                                data={chartConfig.proteinData}
                                data2={chartConfig.carbsData}
                                data3={chartConfig.fatData}
                                width={chartWidth}
                                height={220}
                                spacing={data.length > 30 ? Math.max(6, chartWidth / data.length) : chartWidth / data.length}
                                color1={colors.protein}
                                color2={colors.carbs}
                                color3={colors.fat}
                                startFillColor1={colors.protein}
                                startFillColor2={colors.carbs}
                                startFillColor3={colors.fat}
                                endFillColor1={colors.protein + "55"}
                                endFillColor2={colors.carbs + "55"}
                                endFillColor3={colors.fat + "55"}
                                startOpacity1={0.5}
                                startOpacity2={0.5}
                                startOpacity3={0.5}
                                endOpacity1={0.1}
                                endOpacity2={0.1}
                                endOpacity3={0.1}
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
                                scrollToEnd
                            />
                        )}
                        {chartConfig?.type === "single" && (
                            <LineChart
                                data={chartConfig.mainData}
                                width={chartWidth}
                                height={220}
                                spacing={data.length > 30 ? Math.max(6, chartWidth / data.length) : chartWidth / data.length}
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
                                scrollToEnd
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
