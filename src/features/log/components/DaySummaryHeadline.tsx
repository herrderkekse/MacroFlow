import type { Goals } from "@/src/features/settings/services/settingsDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { splitEatenPlanned, type MacroTotals } from "../helpers/logHelpers";

interface DaySummaryHeadlineProps {
    /** Everything logged for the day, planned entries included. */
    totals: MacroTotals;
    /** The planned-but-not-eaten share of `totals`. */
    scheduledTotals?: MacroTotals;
    goals: Goals;
}

/**
 * The day at a glance — "629 / 2,000 kcal … 1,371 left". It is the log
 * header's pinned row, so it stays in view while the day scrolls under it.
 */
export default function DaySummaryHeadline({ totals, scheduledTotals, goals }: DaySummaryHeadlineProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t, i18n } = useTranslation();
    const { eaten, planned, hasPlanned } = splitEatenPlanned(totals, scheduledTotals);
    const remaining = Math.round(goals.calories - eaten.calories);
    const isOver = goals.calories > 0 && remaining < 0;
    const format = (n: number) => Math.round(n).toLocaleString(i18n.language);

    return (
        <View style={styles.row}>
            <Text style={styles.calories} numberOfLines={1}>
                {format(eaten.calories)}
                <Text style={styles.goal}>
                    {"  / "}{format(goals.calories)} {t("common.kcal")}
                    {hasPlanned ? ` · ${t("log.plannedAmount", { amount: format(planned.calories) })}` : ""}
                </Text>
            </Text>
            {goals.calories > 0 && (
                <Text style={[styles.remaining, isOver && { color: colors.danger }]} numberOfLines={1}>
                    {format(Math.abs(remaining))} {isOver ? t("log.over") : t("log.left")}
                </Text>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
        calories: {
            flex: 1,
            fontSize: fontSize.xl - 1,
            fontWeight: "600",
            letterSpacing: -0.5,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        goal: { fontSize: fontSize.xs, fontWeight: "400", letterSpacing: 0, color: colors.textTertiary },
        remaining: {
            fontSize: fontSize.xs,
            fontWeight: "500",
            color: colors.textTertiary,
            fontVariant: ["tabular-nums"],
        },
    });
}
