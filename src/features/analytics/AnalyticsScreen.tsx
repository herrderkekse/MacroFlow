import { type DailyTotals, formatDateKey, getDailyTotalsForRange } from "@/src/db/queries";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Types and Consts ───────────────────────────────────────

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

const MACRO_KCAL: Record<MacroKey, number> = { protein: 4, carbs: 4, fat: 9 };

const ANIMATION_DURATION = 0; // ms, set to 0 to disable animation
const CURVATURE = 0.1; // 0 = straight lines, 1 = very curvy
const START_OPACITY = 1;
const END_OPACITY = 1;
const START_SHADE = -20;
const END_SHADE = -20;
const GRAPH_HEIGHT = 220;
// ── Helpers ────────────────────────────────────────────────

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDateKey(d);
}

const formatLabel = (d: DailyTotals) => {
    const parts = d.date.split("-");
    return `${parts[2]}/${parts[1]}`;
};


const makeLabelProps = (d: DailyTotals, timespan: TimeSpan, colors: ThemeColors) => {
    const val = formatLabel(d);

    let shouldShowLabel;
    switch (timespan) {
        case 7:
            // Show all labels for 7-day view
            shouldShowLabel = true;
            break;
        case 14:
            // Show labels for every other day for 14-day view
            const dateEndsWithEven = parseInt(d.date.slice(-1)) % 2 === 0;
            shouldShowLabel = dateEndsWithEven;
            break;
        default:
            // Show labels for 1, 11th, 21st, of each month
            const isMonthlyLabel = d.date.endsWith("-01") || d.date.endsWith("-11") || d.date.endsWith("-21");
            shouldShowLabel = isMonthlyLabel;
    }

    return {
        showStrip: shouldShowLabel,
        stripHeight: GRAPH_HEIGHT + 20,
        stripColor: colors.border + "66",
        labelComponent: shouldShowLabel ? () => <LabelItem color={colors.textSecondary} label={val} /> : undefined,
    };
};


function shadeColor(color: string, percent: number): string {
    // Shade a hex color by a percentage (positive = lighter, negative = darker)
    const f = parseInt(color.slice(1), 16);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    const R = f >> 16;
    const G = (f >> 8) & 0x00ff;
    const B = f & 0x0000ff;
    const newR = Math.round((t - R) * p + R);
    const newG = Math.round((t - G) * p + G);
    const newB = Math.round((t - B) * p + B);
    return `#${(0x1000000 + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
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

    const [data, setData] = useState<DailyTotals[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // Defer the heavy query so the UI can show the loading indicator first
        const id = requestAnimationFrame(() => {
            const endDate = formatDateKey(new Date());
            const startDate = timeSpan === "all" ? "2000-01-01" : daysAgo(timeSpan);
            setData(getDailyTotalsForRange(startDate, endDate));
            setLoading(false);
        });
        return () => cancelAnimationFrame(id);
    }, [timeSpan]);

    // ── Chart data ─────────────────────────────────────────

    const chartConfig = useMemo(() => {
        if (data.length === 0) return null;

        if (metric === "calories") {

            // normalize maco values so the macro sum matches calories (handles cases where total calories != sum of macros due to alcohol, fiber, or data issues)
            const normalized = data.map((d) => {
                const macroCal = d.fat * MACRO_KCAL.fat + d.carbs * MACRO_KCAL.carbs + d.protein * MACRO_KCAL.protein;
                const factor = macroCal > 0 ? d.calories / macroCal : 1;
                return {
                    ...d,
                    fat: d.fat * factor,
                    carbs: d.carbs * factor,
                    protein: d.protein * factor,
                };
            });

            // True stacked area: fat (bottom) → carbs → protein → calories line on top
            // Each layer's value = cumulative sum up to that layer
            const fatData = normalized.map((d) => ({
                value: d.fat * MACRO_KCAL.fat,
            }));
            const carbsData = normalized.map((d) => ({
                value: d.fat * MACRO_KCAL.fat + d.carbs * MACRO_KCAL.carbs,
            }));
            const proteinData = normalized.map((d, i) => ({
                value: d.calories, // = d.fat * MACRO_KCAL.fat + d.carbs * MACRO_KCAL.carbs + d.protein * MACRO_KCAL.protein (because of normalization)
                ...makeLabelProps(d, timeSpan, colors),
            }));

            return { type: "calories" as const, fatData, carbsData, proteinData };
        }

        if (metric === "macros") {
            // 100% stacked: each macro as % of total macro calories
            const normalised = data.map((d, i) => {
                let totalMacroCal = d.protein * MACRO_KCAL.protein + d.carbs * MACRO_KCAL.carbs + d.fat * MACRO_KCAL.fat;
                totalMacroCal = totalMacroCal > 0 ? totalMacroCal : 1;
                const pPct = (d.protein * MACRO_KCAL.protein / totalMacroCal) * 100;
                const cPct = (d.carbs * MACRO_KCAL.carbs / totalMacroCal) * 100;
                const fPct = (d.fat * MACRO_KCAL.fat / totalMacroCal) * 100;
                return { ...makeLabelProps(d, timeSpan, colors), pPct, cPct, fPct };
            });

            // Stack: fat on bottom, then carbs, then protein on top
            const fatData = normalised.map((d) => ({
                value: d.fPct,
            }));
            const carbsData = normalised.map((d) => ({
                value: d.fPct + d.cPct,
            }));
            const proteinData = normalised.map((d) => ({
                value: 100, // = d.fPct + d.cPct + d.pPct (because of normalization)
                labelComponent: d.labelComponent,
            }));

            return { type: "macros" as const, proteinData, carbsData, fatData };
        }

        if (metric === "carbs" || metric === "protein" || metric === "fat") {
            const macroKey = metric as MacroKey;

            const dataGram = data.map((d, i) => ({
                value: d[macroKey],
                ...makeLabelProps(d, timeSpan, colors),
            }));

            const kcalFactor = MACRO_KCAL[macroKey];
            const dataKcal = data.map((d) => ({
                value: d[macroKey] * kcalFactor,
            }));

            const maxGrams = Math.max(...data.map((d) => d[macroKey]), 1);
            const maxKcal = maxGrams * kcalFactor;

            return {
                type: "single" as const,
                macroKey,
                mainData: dataGram,
                secondaryData: dataKcal,
                maxKcal,
            };
        }

        logger.warn("[UI] Unknown metric type for analytics chart", { metric });
        return null;

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
        if (metric === "carbs" || metric === "protein" || metric === "fat") {
            const macroKey = metric as MacroKey;
            return computeStats(data.map((d) => d[macroKey]));
        }
        logger.warn("[UI] Unknown metric type for analytics stats", { metric });
        return null;
    }, [data, metric, selectedMacro]);

    const statsUnit = metric === "calories" ? t("common.kcal") : t("common.g");
    const statsLabel = metric === "macros" ? t(`analytics.${selectedMacro}`) : t(`analytics.${metric}`);

    // ── Macro area press for macros chart ──────────────────

    const handleMacroSelect = useCallback((macro: MacroKey) => {
        setSelectedMacro(macro);
    }, []);

    // ── Render ─────────────────────────────────────────────


    // Available width for the chart area inside the card (card has padding + border)
    const screenWidth = Dimensions.get("window").width;
    const chartContainerPadding = spacing.md * 2 + spacing.md * 2 + 2; // scrollContent padding + chartWrapper padding + borders
    const yAxisLabelWidth = 45;
    const secondaryAxisWidth = 45;

    const shouldScroll = typeof timeSpan === "number" && timeSpan >= 90 || timeSpan === "all";

    // For non-scrollable charts, compute spacing so data fills exactly the available width
    const hasSecondaryAxis = chartConfig?.type === "single";
    const chartWidthProp = screenWidth - chartContainerPadding - yAxisLabelWidth - (hasSecondaryAxis ? secondaryAxisWidth - spacing.lg : 0);
    const computedSpacing = data.length > 1 ? chartWidthProp / (data.length - 1) : chartWidthProp;
    // For scrollable charts, use a comfortable fixed spacing
    const scrollSpacing = 8;
    const chartSpacing = shouldScroll ? scrollSpacing : computedSpacing;



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
                {loading ? (
                    <View style={styles.emptyContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : data.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>{t("analytics.noData")}</Text>
                    </View>
                ) : (
                    <View style={styles.chartWrapper}>
                        {chartConfig?.type === "calories" && (
                            <LineChart
                                key={`calories-${timeSpan}`}
                                // chart type dependent props
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
                                // chart type independent props
                                width={chartWidthProp}
                                height={220}
                                spacing={chartSpacing}
                                initialSpacing={0}
                                endSpacing={0}
                                disableScroll={!shouldScroll}
                                scrollToEnd={shouldScroll}
                                noOfSections={5}
                                yAxisColor={colors.border}
                                xAxisColor={colors.border}
                                yAxisTextStyle={styles.yAxisTextStyle}
                                rulesColor={colors.border + "66"}
                                curved
                                curvature={CURVATURE}
                                areaChart
                                hideDataPoints
                                isAnimated={ANIMATION_DURATION > 0}
                                animationDuration={ANIMATION_DURATION}
                                labelsExtraHeight={6}
                                xAxisLabelsHeight={20}
                            />
                        )}
                        {chartConfig?.type === "macros" && (
                            <LineChart
                                key={`macros-${timeSpan}`}
                                // chart type dependent props
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
                                stripOverDataPoints={true}
                                stripOpacity={1}
                                yAxisLabelSuffix="%"
                                maxValue={100}
                                // chart type independent props
                                width={chartWidthProp}
                                height={220}
                                spacing={chartSpacing}
                                initialSpacing={0}
                                endSpacing={0}
                                disableScroll={!shouldScroll}
                                scrollToEnd={shouldScroll}
                                noOfSections={5}
                                yAxisColor={colors.border}
                                xAxisColor={colors.border}
                                yAxisTextStyle={styles.yAxisTextStyle}
                                rulesColor={colors.border + "66"}
                                curved
                                curvature={CURVATURE}
                                areaChart
                                hideDataPoints
                                isAnimated={ANIMATION_DURATION > 0}
                                animationDuration={ANIMATION_DURATION}
                                labelsExtraHeight={6}
                                xAxisLabelsHeight={20}
                            />
                        )}
                        {chartConfig?.type === "single" && (
                            <LineChart
                                key={`single-${timeSpan}`}
                                // chart type dependent props
                                data={chartConfig.mainData}
                                secondaryData={chartConfig.secondaryData}
                                secondaryYAxis={{
                                    maxValue: chartConfig.maxKcal,
                                    yAxisColor: colors.border,
                                    yAxisTextStyle: styles.yAxisTextStyle,
                                    yAxisLabelSuffix: "",
                                }}
                                secondaryLineConfig={{
                                    color: "transparent",
                                }}
                                color1={colors[chartConfig.macroKey]}
                                startFillColor1={shadeColor(colors[chartConfig.macroKey], START_SHADE)}
                                endFillColor1={shadeColor(colors[chartConfig.macroKey], END_SHADE)}
                                startOpacity1={START_OPACITY}
                                endOpacity1={END_OPACITY}
                                yAxisLabelSuffix=" g"
                                // chart type independent props
                                width={chartWidthProp}
                                height={220}
                                spacing={chartSpacing}
                                initialSpacing={0}
                                endSpacing={0}
                                disableScroll={!shouldScroll}
                                scrollToEnd={shouldScroll}
                                noOfSections={5}
                                yAxisColor={colors.border}
                                xAxisColor={colors.border}
                                yAxisTextStyle={styles.yAxisTextStyle}
                                rulesColor={colors.border + "66"}
                                curved
                                curvature={CURVATURE}
                                areaChart
                                hideDataPoints
                                isAnimated={ANIMATION_DURATION > 0}
                                animationDuration={ANIMATION_DURATION}
                                labelsExtraHeight={6}
                                xAxisLabelsHeight={20}
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
                {chartConfig?.type === "calories" && (
                    <Text style={styles.statsNote}>
                        {t("analytics.calorieDisclaimer")}
                    </Text>
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

function LabelItem({ label }: { color: string; label: string }) {
    const colors = useThemeColors();
    return (<View style={{ width: 40 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 9, textAlign: 'center' }} allowFontScaling>
            {label}
        </Text>
    </View>);
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
        yAxisTextStyle: {
            color: colors.textSecondary,
            fontSize: 10
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
