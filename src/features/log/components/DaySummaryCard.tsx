import type { Goals } from "@/src/features/settings/services/settingsDb";
import Card from "@/src/shared/atoms/Card";
import MacroSplitBar from "@/src/shared/components/MacroSplitBar";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const KG_TO_LB = 2.20462;
const MACROS = ["protein", "carbs", "fat"] as const;

interface Totals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface DaySummaryCardProps {
    /** Everything logged for the day, planned entries included. */
    totals: Totals;
    /** The planned-but-not-eaten share of `totals`. */
    scheduledTotals?: Totals;
    goals: Goals;
    meanWeightKg?: number | null;
    weightTrend?: "up" | "down" | "flat" | null;
    weightDaysAgo?: number | null;
}

const TREND_ICON = { up: "arrow-up", down: "arrow-down", flat: "arrow-forward" } as const;

/**
 * The day at a glance: calories against the goal, then the three macros.
 * Tapping it reveals the secondary figures — the macro split and the
 * current weight trend.
 */
export default function DaySummaryCard({
    totals, scheduledTotals, goals, meanWeightKg, weightTrend, weightDaysAgo,
}: DaySummaryCardProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const isImperial = useAppStore((s) => s.unitSystem) === "imperial";

    const planned = scheduledTotals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const eaten = {
        calories: totals.calories - planned.calories,
        protein: totals.protein - planned.protein,
        carbs: totals.carbs - planned.carbs,
        fat: totals.fat - planned.fat,
    };
    const hasPlanned = planned.calories > 0;
    const remaining = Math.round(goals.calories - eaten.calories);
    const isOver = goals.calories > 0 && remaining < 0;

    function toggle() {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((prev) => !prev);
    }

    return (
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded }}>
            <Card style={styles.card}>
                <View style={styles.headline}>
                    <View style={styles.headlineMain}>
                        <Text style={styles.calories}>
                            {Math.round(eaten.calories)}
                            <Text style={styles.caloriesUnit}> {t("common.kcal")}</Text>
                        </Text>
                        <Text style={styles.caption} numberOfLines={1}>
                            {t("log.ofGoal", { goal: Math.round(goals.calories) })}
                            {hasPlanned ? ` · ${t("log.plannedAmount", { amount: Math.round(planned.calories) })}` : ""}
                        </Text>
                    </View>
                    {goals.calories > 0 && (
                        <View style={styles.headlineSide}>
                            <Text style={[styles.remaining, isOver && { color: colors.danger }]}>
                                {Math.abs(remaining)}
                            </Text>
                            <Text style={[styles.caption, isOver && { color: colors.danger }]}>
                                {isOver ? t("log.over") : t("log.left")}
                            </Text>
                        </View>
                    )}
                </View>

                <ProgressTrack
                    value={eaten.calories}
                    planned={planned.calories}
                    goal={goals.calories}
                    color={isOver ? colors.danger : colors.calories}
                    height={8}
                    colors={colors}
                />

                <View style={styles.macros}>
                    {MACROS.map((macro) => (
                        <View key={macro} style={styles.macro}>
                            <Text style={styles.macroLabel} numberOfLines={1}>{t(`common.${macro}`)}</Text>
                            <Text style={styles.macroValue} numberOfLines={1}>
                                {Math.round(eaten[macro])}
                                <Text style={styles.macroGoal}> / {Math.round(goals[macro])} {t("common.g")}</Text>
                            </Text>
                            <ProgressTrack
                                value={eaten[macro]}
                                planned={planned[macro]}
                                goal={goals[macro]}
                                color={colors[macro]}
                                height={4}
                                colors={colors}
                            />
                        </View>
                    ))}
                </View>

                {expanded && (
                    <View style={styles.details}>
                        <MacroSplitBar
                            protein={eaten.protein}
                            carbs={eaten.carbs}
                            fat={eaten.fat}
                            scheduled={hasPlanned ? planned : undefined}
                        />
                        {meanWeightKg != null && (
                            <View style={styles.weightRow}>
                                <Ionicons name="scale-outline" size={15} color={colors.textSecondary} />
                                <Text style={styles.weightText}>
                                    {isImperial ? (meanWeightKg * KG_TO_LB).toFixed(1) + " lb" : meanWeightKg.toFixed(1) + " kg"}
                                </Text>
                                {weightTrend && (
                                    <Ionicons name={TREND_ICON[weightTrend]} size={13} color={colors.textSecondary} />
                                )}
                                {weightDaysAgo != null && weightDaysAgo > 0 && (
                                    <Text style={styles.caption}>{t("log.weightDaysAgo", { count: weightDaysAgo })}</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}

                <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.textTertiary}
                    style={styles.chevron}
                />
            </Card>
        </Pressable>
    );
}

interface ProgressTrackProps {
    value: number;
    planned: number;
    goal: number;
    color: string;
    height: number;
    colors: ThemeColors;
}

/** A goal bar: the eaten share in colour, the planned share as a ghost behind it. */
function ProgressTrack({ value, planned, goal, color, height, colors }: ProgressTrackProps) {
    const ratio = goal > 0 ? Math.min(Math.max(value / goal, 0), 1) : 0;
    const plannedRatio = goal > 0 ? Math.min(Math.max((value + planned) / goal, 0), 1) : 0;
    const bar = { height, borderRadius: borderRadius.full };

    return (
        <View style={[trackStyles.track, bar, { backgroundColor: colors.border }]}>
            {plannedRatio > ratio && (
                <View style={[trackStyles.fill, bar, { width: `${plannedRatio * 100}%`, backgroundColor: colors.disabled }]} />
            )}
            <View style={[trackStyles.fill, bar, { width: `${ratio * 100}%`, backgroundColor: color }]} />
        </View>
    );
}

const trackStyles = StyleSheet.create({
    track: { overflow: "hidden" },
    fill: { position: "absolute", left: 0, top: 0 },
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: { marginBottom: spacing.sm + 4, paddingBottom: spacing.sm },
        headline: { flexDirection: "row", alignItems: "flex-end", marginBottom: spacing.sm + 4 },
        headlineMain: { flex: 1 },
        headlineSide: { alignItems: "flex-end" },
        calories: {
            fontSize: fontSize.xxl + 4,
            fontWeight: "700",
            letterSpacing: -0.8,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        caloriesUnit: { fontSize: fontSize.sm, fontWeight: "500", letterSpacing: 0, color: colors.textSecondary },
        caption: { fontSize: fontSize.xs, color: colors.textSecondary },
        remaining: {
            fontSize: fontSize.lg,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        macros: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
        macro: { flex: 1, gap: 4 },
        macroLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
        macroValue: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
            marginBottom: 2,
        },
        macroGoal: { fontSize: fontSize.xs, fontWeight: "400", color: colors.textTertiary },
        details: {
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            gap: spacing.md,
        },
        weightRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
        weightText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        chevron: { alignSelf: "center", marginTop: spacing.sm },
    });
}
