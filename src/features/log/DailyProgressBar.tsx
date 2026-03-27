import type { Goals } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    LayoutAnimation,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    UIManager,
    View,
} from "react-native";

if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
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
    goals: Goals;
    meanWeightKg?: number | null;
    weightTrend?: "up" | "down" | "flat" | null;
}

function ProgressRow({
    label,
    current,
    goal,
    color,
    unit,
    colors,
}: {
    label: string;
    current: number;
    goal: number;
    color: string;
    unit: string;
    colors: ThemeColors;
}) {
    const ratio = goal > 0 ? Math.min(current / goal, 1) : 0;
    const rs = useMemo(() => createRowStyles(colors), [colors]);

    return (
        <View style={rs.container}>
            <View style={rs.labelRow}>
                <Text style={[rs.label, { color }]}>{label}</Text>
                <Text style={rs.values}>
                    {Math.round(current)}{" "}
                    <Text style={rs.separator}>/</Text>{" "}
                    {Math.round(goal)} {unit}
                </Text>
            </View>
            <View style={rs.track}>
                <View
                    style={[
                        rs.fill,
                        {
                            backgroundColor: color,
                            width: `${ratio * 100}%`,
                        },
                    ]}
                />
            </View>
        </View>
    );
}

function createRowStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { marginTop: spacing.sm },
        labelRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
        },
        label: {
            fontSize: fontSize.xs,
            fontWeight: "600",
        },
        values: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
        },
        separator: {
            color: colors.textTertiary,
        },
        track: {
            height: 6,
            backgroundColor: colors.border,
            borderRadius: 3,
            overflow: "hidden",
        },
        fill: {
            height: 6,
            borderRadius: 3,
        },
    });
}

export default function DailyProgressBar({
    totals,
    goals,
    meanWeightKg,
    weightTrend,
}: DailyProgressBarProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const unitSystem = useAppStore((s) => s.unitSystem);
    const isImperial = unitSystem === "imperial";
    const KG_TO_LB = 2.20462;

    const calRatio =
        goals.calories > 0 ? Math.min(totals.calories / goals.calories, 1) : 0;
    const isOverCalories = goals.calories > 0 && totals.calories > goals.calories;

    function toggle() {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((prev) => !prev);
    }

    return (
        <Pressable style={styles.container} onPress={toggle}>
            {/* Calorie bar – always visible */}
            <View style={styles.headerRow}>
                <Text style={[styles.calorieText, isOverCalories && styles.calorieTextOver]}>
                    {Math.round(totals.calories)}{" "}
                    <Text style={styles.goalText}>
                        / {Math.round(goals.calories)} kcal
                    </Text>
                </Text>
                <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.textTertiary}
                />
            </View>
            <View style={styles.track}>
                <View
                    style={[
                        styles.fill,
                        {
                            backgroundColor: colors.calories,
                            width: `${calRatio * 100}%`,
                        },
                    ]}
                />
            </View>

            {/* Expanded macro bars */}
            {expanded && (
                <View style={styles.macros}>
                    <ProgressRow
                        label={t("settings.protein")}
                        current={totals.protein}
                        goal={goals.protein}
                        color={colors.protein}
                        unit="g"
                        colors={colors}
                    />
                    <ProgressRow
                        label={t("settings.carbs")}
                        current={totals.carbs}
                        goal={goals.carbs}
                        color={colors.carbs}
                        unit="g"
                        colors={colors}
                    />
                    <ProgressRow
                        label={t("settings.fat")}
                        current={totals.fat}
                        goal={goals.fat}
                        color={colors.fat}
                        unit="g"
                        colors={colors}
                    />
                    {meanWeightKg != null && (
                        <View style={styles.weightRow}>
                            <Ionicons name="scale-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.weightText}>
                                {isImperial
                                    ? (meanWeightKg * KG_TO_LB).toFixed(1) + " lb"
                                    : meanWeightKg.toFixed(1) + " kg"}
                            </Text>
                            <View style={{ flex: 1 }} />
                            {weightTrend === "up" && (
                                <Ionicons name="arrow-up" size={14} color={colors.textSecondary} />
                            )}
                            {weightTrend === "down" && (
                                <Ionicons name="arrow-down" size={14} color={colors.textSecondary} />
                            )}
                            {weightTrend === "flat" && (
                                <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
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
        container: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        headerRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.sm,
        },
        calorieText: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
        },
        calorieTextOver: {
            color: colors.danger,
        },
        goalText: {
            fontWeight: "400",
            color: colors.textSecondary,
        },
        track: {
            height: 8,
            backgroundColor: colors.border,
            borderRadius: 4,
            overflow: "hidden",
        },
        fill: {
            height: 8,
            borderRadius: 4,
        },
        macros: {
            marginTop: spacing.xs,
        },
        weightRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        weightText: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
        },
    });
}
