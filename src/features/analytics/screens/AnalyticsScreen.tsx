import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnalyticsChart from "../components/AnalyticsChart";
import { type MacroKey, METRICS, TIME_SPANS } from "../helpers/analyticsHelpers";
import { useAnalyticsData } from "../hooks/useAnalyticsData";

// ── Sub-component ──────────────────────────────────────────

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

// ── Screen ─────────────────────────────────────────────────

export default function AnalyticsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const a = useAnalyticsData();

    // Chart layout
    const hasSecondaryAxis = a.metric === "carbs" || a.metric === "protein" || a.metric === "fat";
    const chartWidthProp =
        a.screenWidth - a.chartContainerPadding - a.yAxisLabelWidth - (hasSecondaryAxis ? a.secondaryAxisWidth - spacing.lg : 0);
    const pointCount =
        a.metric === "weight" ? a.weightData.length : a.data.length;
    const computedSpacing = pointCount > 1 ? chartWidthProp / (pointCount - 1) : chartWidthProp;
    const chartSpacing = a.shouldScroll ? 8 : computedSpacing;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.titleRow}>
                <Pressable onPress={() => router.navigate("/(tabs)/more" as any)} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </Pressable>
                <Text style={styles.title}>{t("analytics.title")}</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Time Span Selector */}
                <Text style={styles.sectionLabel}>{t("analytics.timeSpan")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {TIME_SPANS.map((ts) => (
                        <Pressable
                            key={String(ts.key)}
                            style={[styles.chip, a.timeSpan === ts.key && styles.chipActive]}
                            onPress={() => a.setTimeSpan(ts.key)}
                        >
                            <Text style={[styles.chipText, a.timeSpan === ts.key && styles.chipTextActive]}>
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
                            style={[styles.chip, a.metric === m.key && styles.chipActive]}
                            onPress={() => a.setMetric(m.key)}
                        >
                            <Text style={[styles.chipText, a.metric === m.key && styles.chipTextActive]}>
                                {t(m.labelKey)}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Macro sub-selector */}
                {a.metric === "macros" && (
                    <View style={styles.macroSubRow}>
                        {(["protein", "carbs", "fat"] as MacroKey[]).map((m) => (
                            <Pressable
                                key={m}
                                style={[
                                    styles.macroChip,
                                    { borderColor: colors[m] },
                                    a.selectedMacro === m && { backgroundColor: colors[m] },
                                ]}
                                onPress={() => a.handleMacroSelect(m)}
                            >
                                <Text style={[styles.macroChipText, { color: a.selectedMacro === m ? "#fff" : colors[m] }]}>
                                    {t(`analytics.${m}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* Statistics */}
                {a.stats && (
                    <Pressable style={styles.statsContainer} onPress={() => a.setStatsOpen((o: boolean) => !o)}>
                        <View style={styles.statsHeader}>
                            <Text style={styles.statsTitle}>{t("analytics.statistics")}</Text>
                            <Ionicons name={a.statsOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
                        </View>
                        <View style={styles.statsRow}>
                            <StatCell label={t("analytics.min")} value={`${a.formatNum(a.stats.min)} ${a.statsUnit}`} colors={colors} />
                            <StatCell label={t("analytics.avg")} value={`${a.formatNum(a.stats.avg)} ${a.statsUnit}`} colors={colors} />
                            <StatCell label={t("analytics.max")} value={`${a.formatNum(a.stats.max)} ${a.statsUnit}`} colors={colors} />
                        </View>
                        {a.statsOpen && (
                            <>
                                <View style={styles.statsRow}>
                                    <StatCell label={t("analytics.stdDev")} value={`${a.formatNum(a.stats.stdDev)} ${a.statsUnit}`} colors={colors} />
                                    <StatCell label={t("analytics.variance")} value={a.formatNum(a.stats.variance, 0)} colors={colors} />
                                    <StatCell
                                        label={t("analytics.trend")}
                                        value={t(`analytics.trend${a.stats.trend.charAt(0).toUpperCase() + a.stats.trend.slice(1)}` as any)}
                                        colors={colors}
                                    />
                                </View>
                                <Text style={styles.statsNote}>{a.statsLabel}</Text>
                            </>
                        )}
                    </Pressable>
                )}

                {/* Chart */}
                <AnalyticsChart
                    data={a.data}
                    weightData={a.weightData}
                    metric={a.metric}
                    timeSpan={a.timeSpan}
                    isImperial={a.isImperial}
                    KG_TO_LB={a.KG_TO_LB}
                    chartWidthProp={chartWidthProp}
                    chartSpacing={chartSpacing}
                    shouldScroll={a.shouldScroll}
                    loading={a.loading}
                />

                {a.metric === "calories" && (
                    <Text style={styles.statsNote}>{t("analytics.calorieDisclaimer")}</Text>
                )}
            </ScrollView>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
        },
        backBtn: { padding: 4, marginRight: spacing.sm },
        title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
        scroll: { flex: 1 },
        scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            marginTop: spacing.md,
            marginBottom: spacing.xs,
            letterSpacing: 0.5,
        },
        chipRow: { flexDirection: "row", marginBottom: spacing.xs },
        chip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            marginRight: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
        },
        chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
        chipTextActive: { color: "#fff" },
        macroSubRow: { flexDirection: "row", marginTop: spacing.sm, marginBottom: spacing.xs, gap: spacing.sm },
        macroChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5, alignItems: "center" },
        macroChipText: { fontWeight: "600", fontSize: fontSize.sm },
        statsContainer: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        statsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
        statsTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
        statsRow: { flexDirection: "row", marginBottom: spacing.sm },
        statsNote: { fontSize: fontSize.xs, color: colors.textTertiary, textAlign: "center", marginTop: spacing.xs },
    });
}
