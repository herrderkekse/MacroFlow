import type { Goals } from "@/src/features/settings/services/settingsDb";
import MacroSplitBar from "@/src/shared/components/MacroSplitBar";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { splitEatenPlanned, type MacroTotals } from "../helpers/logHelpers";
import ProgressTrack from "./ProgressTrack";

const KG_TO_LB = 2.20462;
const MACROS = ["protein", "carbs", "fat"] as const;
const TREND_ICON = {
    up: "arrow-up",
    down: "arrow-down",
    flat: "arrow-forward",
} as const;

interface DaySummaryDetailsProps {
    totals: MacroTotals;
    scheduledTotals?: MacroTotals;
    goals: Goals;
    meanWeightKg?: number | null;
    weightTrend?: "up" | "down" | "flat" | null;
    weightDaysAgo?: number | null;
}

/** The rest of the day's summary: each macro against its goal, the split and the weight trend. */
export default function DaySummaryDetails({
    totals,
    scheduledTotals,
    goals,
    meanWeightKg,
    weightTrend,
    weightDaysAgo,
}: DaySummaryDetailsProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const isImperial = useAppStore((s) => s.unitSystem) === "imperial";
    const { eaten, planned, hasPlanned } = splitEatenPlanned(totals, scheduledTotals);

    return (
        <View style={styles.root}>
            {MACROS.map((macro) => {
                const left = Math.round(goals[macro] - eaten[macro]);
                const isOver = goals[macro] > 0 && left < 0;
                return (
                    <View key={macro} accessibilityLabel={t(`common.${macro}`)}>
                        <View style={styles.macroLine}>
                            <Text style={styles.macroValue} numberOfLines={1}>
                                {Math.round(eaten[macro])}
                                <Text style={styles.macroGoal}>
                                    {" / "}
                                    {Math.round(goals[macro])} {t("common.g")}
                                </Text>
                            </Text>
                            {goals[macro] > 0 && (
                                <Text style={[styles.macroLeft, isOver && { color: colors.danger }]} numberOfLines={1}>
                                    {Math.abs(left)} {t("common.g")} {isOver ? t("log.over") : t("log.left")}
                                </Text>
                            )}
                        </View>
                        <ProgressTrack
                            value={eaten[macro]}
                            planned={planned[macro]}
                            goal={goals[macro]}
                            color={colors[macro]}
                            height={5}
                            colors={colors}
                        />
                    </View>
                );
            })}
            <MacroSplitBar
                compact
                protein={eaten.protein}
                carbs={eaten.carbs}
                fat={eaten.fat}
                scheduled={hasPlanned ? planned : undefined}
            />
            {meanWeightKg != null && (
                <View style={styles.weightRow}>
                    <Ionicons name="scale-outline" size={15} color={colors.textTertiary} />
                    <Text style={styles.weightText}>
                        {isImperial ? (meanWeightKg * KG_TO_LB).toFixed(1) + " lb" : meanWeightKg.toFixed(1) + " kg"}
                    </Text>
                    {weightTrend && <Ionicons name={TREND_ICON[weightTrend]} size={12} color={colors.textTertiary} />}
                    {weightDaysAgo != null && (
                        <Text style={styles.caption} numberOfLines={1}>
                            {weightDaysAgo > 0
                                ? t("log.weightLoggedDaysAgo", { count: weightDaysAgo })
                                : t("log.weightLoggedToday")}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        root: { gap: spacing.sm + 4 },
        macroLine: {
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 5,
        },
        macroValue: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        macroGoal: {
            fontSize: fontSize.xs - 1,
            fontWeight: "400",
            color: colors.textTertiary,
        },
        macroLeft: {
            fontSize: fontSize.xs - 1,
            fontWeight: "500",
            color: colors.textTertiary,
            fontVariant: ["tabular-nums"],
        },
        caption: {
            flexShrink: 1,
            fontSize: fontSize.xs,
            color: colors.textTertiary,
        },
        weightRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs + 3,
            paddingTop: spacing.sm + 4,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        weightText: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
        },
    });
}
