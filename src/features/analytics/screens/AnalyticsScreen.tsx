import Card from "@/src/shared/atoms/Card";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AnalyticsChart from "../components/AnalyticsChart";
import { type MacroKey, METRICS, TIME_SPANS } from "../helpers/analyticsHelpers";
import { useAnalyticsData } from "../hooks/useAnalyticsData";

// ── Sub-component ──────────────────────────────────────────

function StatCell({ label, value, unit, colors }: { label: string; value: string; unit?: string; colors: ThemeColors }) {
    return (
        <View style={statStyles.cell}>
            <Text style={[statStyles.label, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
            <Text style={[statStyles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {value}
                {unit ? <Text style={[statStyles.unit, { color: colors.textTertiary }]}> {unit}</Text> : null}
            </Text>
        </View>
    );
}

const statStyles = StyleSheet.create({
    cell: { flex: 1 },
    label: { fontSize: fontSize.xs },
    value: { fontSize: fontSize.md, fontWeight: "600", marginTop: 2, fontVariant: ["tabular-nums"] },
    unit: { fontSize: fontSize.xxs, fontWeight: "400" },
});

// ── Screen ─────────────────────────────────────────────────

export default function AnalyticsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const a = useAnalyticsData();

    return (
        <View style={styles.container}>
            <ScreenHeader title={t("more.analytics")} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <SegmentedControl
                    options={METRICS.map((m) => ({ key: m.key, label: t(m.labelKey) }))}
                    value={a.metric}
                    onChange={a.setMetric}
                />

                {a.metric === "macros" && (
                    <SegmentedControl<MacroKey>
                        size="sm"
                        options={(["protein", "carbs", "fat"] as MacroKey[]).map((m) => ({ key: m, label: t(`analytics.${m}`) }))}
                        value={a.selectedMacro}
                        onChange={a.handleMacroSelect}
                        style={styles.macroPicker}
                    />
                )}

                <SegmentedControl
                    size="sm"
                    options={TIME_SPANS.map((ts) => ({ key: ts.key, label: t(ts.labelKey) }))}
                    value={a.timeSpan}
                    onChange={a.setTimeSpan}
                    style={styles.span}
                />

                <AnalyticsChart
                    metric={a.metric}
                    range={a.range}
                    data={a.data}
                    weightLogs={a.weightLogs}
                    goals={a.goals}
                    goalHistory={a.goalHistory}
                    isImperial={a.isImperial}
                    loading={a.loading}
                />

                {a.stats && (
                    <>
                        <SectionLabel>{t("analytics.statistics")}</SectionLabel>
                        <Pressable
                            onPress={() => a.setStatsOpen((o: boolean) => !o)}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: a.statsOpen }}
                        >
                            <Card>
                                <View style={styles.statsRow}>
                                    <StatCell label={t("analytics.min")} value={a.formatNum(a.stats.min)} unit={a.statsUnit} colors={colors} />
                                    <StatCell label={t("analytics.avg")} value={a.formatNum(a.stats.avg)} unit={a.statsUnit} colors={colors} />
                                    <StatCell label={t("analytics.median")} value={a.formatNum(a.stats.median)} unit={a.statsUnit} colors={colors} />
                                    <StatCell label={t("analytics.max")} value={a.formatNum(a.stats.max)} unit={a.statsUnit} colors={colors} />
                                </View>
                                {a.statsOpen && (
                                    <View style={styles.statsMore}>
                                        <View style={styles.statsRow}>
                                            <StatCell label={t("analytics.stdDev")} value={a.formatNum(a.stats.stdDev)} unit={a.statsUnit} colors={colors} />
                                            <StatCell label={t("analytics.variance")} value={a.formatNum(a.stats.variance, 0)} colors={colors} />
                                            <StatCell
                                                label={t("analytics.trend")}
                                                value={t(`analytics.trend${a.stats.trend.charAt(0).toUpperCase() + a.stats.trend.slice(1)}` as any)}
                                                colors={colors}
                                            />
                                            <View style={styles.statSpacer} />
                                        </View>
                                        <Text style={styles.note}>{a.statsLabel}</Text>
                                    </View>
                                )}
                                <Ionicons
                                    name={a.statsOpen ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color={colors.textTertiary}
                                    style={styles.chevron}
                                />
                            </Card>
                        </Pressable>
                    </>
                )}

                {a.metric === "calories" && (
                    <Text style={[styles.note, styles.disclaimer]}>{t("analytics.calorieDisclaimer")}</Text>
                )}
            </ScrollView>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scrollContent: { paddingHorizontal: screenPadding, paddingTop: spacing.xs, paddingBottom: spacing.xl },
        // Bleeds to the screen edge so the chips scroll under it.
        macroPicker: { marginTop: spacing.sm + 4 },
        span: { marginTop: spacing.sm + 4, marginBottom: spacing.sm + 4 },
        statsRow: { flexDirection: "row", gap: spacing.sm },
        statSpacer: { flex: 1 },
        statsMore: {
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        chevron: { alignSelf: "center", marginTop: spacing.sm, marginBottom: -spacing.xs },
        note: { fontSize: fontSize.xs, lineHeight: 17, color: colors.textTertiary, marginTop: spacing.sm },
        disclaimer: { marginHorizontal: spacing.xs },
    });
}
