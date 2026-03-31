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
    scheduledTotals?: Totals;
    goals: Goals;
    meanWeightKg?: number | null;
    weightTrend?: "up" | "down" | "flat" | null;
    weightDaysAgo?: number | null;
}

function ProgressRow({
    label,
    current,
    goal,
    color,
    unit,
    colors,
    scheduled,
}: {
    label: string;
    current: number;
    goal: number;
    color: string;
    unit: string;
    colors: ThemeColors;
    scheduled?: number;
}) {
    const ratio = goal > 0 ? Math.min(current / goal, 1) : 0;
    const scheduledRatio = goal > 0 && scheduled ? Math.min((current + scheduled) / goal, 1) : 0;
    const hasScheduled = scheduled != null && scheduled > 0;
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
                {hasScheduled && scheduledRatio > ratio && (
                    <View
                        style={[
                            rs.scheduledFill,
                            {
                                width: `${scheduledRatio * 100}%`,
                            },
                        ]}
                    />
                )}
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

function MacroMakeupBar({ totals, scheduledTotals, colors, t }: { totals: Totals; scheduledTotals?: Totals; colors: ThemeColors; t: (key: string) => string; }) {
    const pCal = totals.protein * 4;
    const cCal = totals.carbs * 4;
    const fCal = totals.fat * 9;
    const total = pCal + cCal + fCal;

    if (total <= 0) return null;

    const pPct = Math.round((pCal / total) * 100);
    const cPct = Math.round((cCal / total) * 100);
    const fPct = Math.round((fCal / total) * 100);

    // Compute percentage change if scheduled entries exist
    const hasScheduled = scheduledTotals && (scheduledTotals.protein > 0 || scheduledTotals.carbs > 0 || scheduledTotals.fat > 0);
    let pDiff = 0, cDiff = 0, fDiff = 0;
    if (hasScheduled) {
        const withP = (totals.protein + scheduledTotals.protein) * 4;
        const withC = (totals.carbs + scheduledTotals.carbs) * 4;
        const withF = (totals.fat + scheduledTotals.fat) * 9;
        const withTotal = withP + withC + withF;
        if (withTotal > 0) {
            pDiff = Math.round((withP / withTotal) * 100) - pPct;
            cDiff = Math.round((withC / withTotal) * 100) - cPct;
            fDiff = Math.round((withF / withTotal) * 100) - fPct;
        }
    }

    function formatDiff(diff: number): string {
        if (diff > 0) return ` +${diff}%`;
        if (diff < 0) return ` ${diff}%`;
        return ` +0%`;
    }

    return (
        <View style={makeupStyles.container}>
            <View style={makeupStyles.legendRow}>
                <View style={makeupStyles.legendItem}>
                    <View style={[makeupStyles.dot, { backgroundColor: colors.protein }]} />
                    <Text style={[makeupStyles.legendText, { color: colors.textSecondary }]}>
                        {t("settings.protein")} {pPct}%
                        {hasScheduled && <Text style={{ color: colors.disabled }}>{formatDiff(pDiff)}</Text>}
                    </Text>
                </View>
                <View style={makeupStyles.legendItem}>
                    <View style={[makeupStyles.dot, { backgroundColor: colors.carbs }]} />
                    <Text style={[makeupStyles.legendText, { color: colors.textSecondary }]}>
                        {t("settings.carbs")} {cPct}%
                        {hasScheduled && <Text style={{ color: colors.disabled }}>{formatDiff(cDiff)}</Text>}
                    </Text>
                </View>
                <View style={makeupStyles.legendItem}>
                    <View style={[makeupStyles.dot, { backgroundColor: colors.fat }]} />
                    <Text style={[makeupStyles.legendText, { color: colors.textSecondary }]}>
                        {t("settings.fat")} {fPct}%
                        {hasScheduled && <Text style={{ color: colors.disabled }}>{formatDiff(fDiff)}</Text>}
                    </Text>
                </View>
            </View>
            <View style={makeupStyles.bar}>
                <View
                    style={[
                        makeupStyles.segment,
                        {
                            flex: pCal,
                            backgroundColor: colors.protein,
                            borderTopLeftRadius: 3,
                            borderBottomLeftRadius: 3,
                        },
                    ]}
                />
                <View
                    style={[
                        makeupStyles.segment,
                        { flex: cCal, backgroundColor: colors.carbs },
                    ]}
                />
                <View
                    style={[
                        makeupStyles.segment,
                        {
                            flex: fCal,
                            backgroundColor: colors.fat,
                            borderTopRightRadius: 3,
                            borderBottomRightRadius: 3,
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const makeupStyles = StyleSheet.create({
    container: { marginTop: spacing.sm },
    bar: {
        flexDirection: "row",
        height: 6,
        borderRadius: 3,
        overflow: "hidden",
    },
    segment: { height: 6 },
    legendRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    legendText: { fontSize: fontSize.xs },
});

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
        scheduledFill: {
            position: "absolute",
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.disabled,
        },
    });
}

export default function DailyProgressBar({
    totals,
    scheduledTotals,
    goals,
    meanWeightKg,
    weightTrend,
    weightDaysAgo,
}: DailyProgressBarProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const unitSystem = useAppStore((s) => s.unitSystem);
    const isImperial = unitSystem === "imperial";
    const KG_TO_LB = 2.20462;

    // Actual (non-scheduled) totals for progress bars
    const actualCalories = totals.calories - (scheduledTotals?.calories ?? 0);
    const calRatio =
        goals.calories > 0 ? Math.min(actualCalories / goals.calories, 1) : 0;
    const scheduledCalRatio = scheduledTotals && goals.calories > 0
        ? Math.min(totals.calories / goals.calories, 1)
        : 0;
    const hasScheduledCalories = scheduledTotals != null && scheduledTotals.calories > 0;
    const isOverCalories = goals.calories > 0 && actualCalories > goals.calories;

    function toggle() {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((prev) => !prev);
    }

    return (
        <Pressable style={styles.container} onPress={toggle}>
            {/* Calorie bar – always visible */}
            <View style={styles.headerRow}>
                <Text style={[styles.calorieText, isOverCalories && styles.calorieTextOver]}>
                    {Math.round(actualCalories)}{" "}
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
                {hasScheduledCalories && scheduledCalRatio > calRatio && (
                    <View
                        style={[
                            styles.scheduledFill,
                            {
                                width: `${scheduledCalRatio * 100}%`,
                            },
                        ]}
                    />
                )}
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
                        current={totals.protein - (scheduledTotals?.protein ?? 0)}
                        goal={goals.protein}
                        color={colors.protein}
                        unit="g"
                        colors={colors}
                        scheduled={scheduledTotals?.protein}
                    />
                    <ProgressRow
                        label={t("settings.carbs")}
                        current={totals.carbs - (scheduledTotals?.carbs ?? 0)}
                        goal={goals.carbs}
                        color={colors.carbs}
                        unit="g"
                        colors={colors}
                        scheduled={scheduledTotals?.carbs}
                    />
                    <ProgressRow
                        label={t("settings.fat")}
                        current={totals.fat - (scheduledTotals?.fat ?? 0)}
                        goal={goals.fat}
                        color={colors.fat}
                        unit="g"
                        colors={colors}
                        scheduled={scheduledTotals?.fat}
                    />

                    {/* Macro makeup bar */}
                    <MacroMakeupBar
                        totals={{ calories: actualCalories, protein: totals.protein - (scheduledTotals?.protein ?? 0), carbs: totals.carbs - (scheduledTotals?.carbs ?? 0), fat: totals.fat - (scheduledTotals?.fat ?? 0) }}
                        scheduledTotals={scheduledTotals}
                        colors={colors}
                        t={t}
                    />

                    {meanWeightKg != null && (
                        <View style={styles.weightRow}>
                            <Ionicons name="scale-outline" size={14} color={colors.textSecondary} />
                            {weightTrend === "up" && (
                                <Ionicons name="arrow-up" size={12} color={colors.textSecondary} />
                            )}
                            {weightTrend === "down" && (
                                <Ionicons name="arrow-down" size={12} color={colors.textSecondary} />
                            )}
                            {weightTrend === "flat" && (
                                <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} />
                            )}
                            <Text style={styles.weightText}>
                                {isImperial
                                    ? (meanWeightKg * KG_TO_LB).toFixed(1) + " lb"
                                    : meanWeightKg.toFixed(1) + " kg"}
                            </Text>
                            {weightDaysAgo != null && weightDaysAgo > 0 && (
                                <Text style={styles.weightDaysAgo}>
                                    {t("log.weightDaysAgo", { count: weightDaysAgo })}
                                </Text>
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
        scheduledFill: {
            position: "absolute",
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.disabled,
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
        weightDaysAgo: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            marginLeft: spacing.xs,
        },
    });
}
