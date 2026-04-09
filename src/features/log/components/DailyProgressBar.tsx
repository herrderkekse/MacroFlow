import type { Goals } from "@/src/features/settings/services/settingsDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import MacroMakeupBar from "./MacroMakeupBar";
import ProgressRow from "./ProgressRow";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Totals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface DailyProgressBarProps {
    totals: Totals;
    scheduledTotals?: Totals;
    goals: Goals;
    meanWeightKg?: number | null;
    weightTrend?: "up" | "down" | "flat" | null;
    weightDaysAgo?: number | null;
}

export default function DailyProgressBar({
    totals, scheduledTotals, goals, meanWeightKg, weightTrend, weightDaysAgo,
}: DailyProgressBarProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const unitSystem = useAppStore((s) => s.unitSystem);
    const isImperial = unitSystem === "imperial";
    const KG_TO_LB = 2.20462;

    const actualCalories = totals.calories - (scheduledTotals?.calories ?? 0);
    const calRatio = goals.calories > 0 ? Math.min(actualCalories / goals.calories, 1) : 0;
    const scheduledCalRatio = scheduledTotals && goals.calories > 0 ? Math.min(totals.calories / goals.calories, 1) : 0;
    const hasScheduledCalories = scheduledTotals != null && scheduledTotals.calories > 0;
    const isOverCalories = goals.calories > 0 && actualCalories > goals.calories;

    function toggle() {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((prev) => !prev);
    }

    return (
        <Pressable style={styles.container} onPress={toggle}>
            <View style={styles.headerRow}>
                <Text style={[styles.calorieText, isOverCalories && styles.calorieTextOver]}>
                    {Math.round(actualCalories)}{" "}
                    <Text style={styles.goalText}>/ {Math.round(goals.calories)} kcal</Text>
                </Text>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} />
            </View>
            <View style={styles.track}>
                {hasScheduledCalories && scheduledCalRatio > calRatio && (
                    <View style={[styles.scheduledFill, { width: `${scheduledCalRatio * 100}%` }]} />
                )}
                <View style={[styles.fill, { backgroundColor: colors.calories, width: `${calRatio * 100}%` }]} />
            </View>

            {expanded && (
                <View style={styles.macros}>
                    <ProgressRow label={t("settings.protein")} current={totals.protein - (scheduledTotals?.protein ?? 0)}
                        goal={goals.protein} color={colors.protein} unit="g" colors={colors} scheduled={scheduledTotals?.protein} />
                    <ProgressRow label={t("settings.carbs")} current={totals.carbs - (scheduledTotals?.carbs ?? 0)}
                        goal={goals.carbs} color={colors.carbs} unit="g" colors={colors} scheduled={scheduledTotals?.carbs} />
                    <ProgressRow label={t("settings.fat")} current={totals.fat - (scheduledTotals?.fat ?? 0)}
                        goal={goals.fat} color={colors.fat} unit="g" colors={colors} scheduled={scheduledTotals?.fat} />

                    <MacroMakeupBar
                        totals={{ calories: actualCalories, protein: totals.protein - (scheduledTotals?.protein ?? 0), carbs: totals.carbs - (scheduledTotals?.carbs ?? 0), fat: totals.fat - (scheduledTotals?.fat ?? 0) }}
                        scheduledTotals={scheduledTotals} colors={colors} t={t} />

                    {meanWeightKg != null && (
                        <View style={styles.weightRow}>
                            <Ionicons name="scale-outline" size={14} color={colors.textSecondary} />
                            {weightTrend === "up" && <Ionicons name="arrow-up" size={12} color={colors.textSecondary} />}
                            {weightTrend === "down" && <Ionicons name="arrow-down" size={12} color={colors.textSecondary} />}
                            {weightTrend === "flat" && <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} />}
                            <Text style={styles.weightText}>
                                {isImperial ? (meanWeightKg * KG_TO_LB).toFixed(1) + " lb" : meanWeightKg.toFixed(1) + " kg"}
                            </Text>
                            {weightDaysAgo != null && weightDaysAgo > 0 && (
                                <Text style={styles.weightDaysAgo}>{t("log.weightDaysAgo", { count: weightDaysAgo })}</Text>
                            )}
                        </View>
                    )}
                </View>
            )}
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
        headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
        calorieText: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
        calorieTextOver: { color: colors.danger },
        goalText: { fontWeight: "400", color: colors.textSecondary },
        track: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
        fill: { height: 8, borderRadius: 4 },
        scheduledFill: { position: "absolute", height: 8, borderRadius: 4, backgroundColor: colors.disabled },
        macros: { marginTop: spacing.xs },
        weightRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
        weightText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary },
        weightDaysAgo: { fontSize: fontSize.xs, color: colors.textTertiary, marginLeft: spacing.xs },
    });
}
