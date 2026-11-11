import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing } from "@/src/utils/theme";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

interface MacroGrams {
    protein: number;
    carbs: number;
    fat: number;
}

interface MacroSplitBarProps extends MacroGrams {
    /**
     * Grams that are planned but not eaten yet. When given, the legend shows
     * how each share would shift once they are eaten.
     */
    scheduled?: MacroGrams;
}

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;
const MACROS = ["protein", "carbs", "fat"] as const;

function shares(grams: MacroGrams) {
    const kcal = MACROS.map((m) => grams[m] * KCAL_PER_GRAM[m]);
    const total = kcal[0] + kcal[1] + kcal[2];
    return { kcal, total, percent: kcal.map((k) => (total > 0 ? Math.round((k / total) * 100) : 0)) };
}

/**
 * The one macro split: a single bar divided by energy share, with a legend.
 * Wherever the three macro colours appear as a bar, it is this component.
 */
export default function MacroSplitBar({ protein, carbs, fat, scheduled }: MacroSplitBarProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const now = shares({ protein, carbs, fat });
    if (now.total <= 0) return null;

    const hasScheduled = !!scheduled && (scheduled.protein > 0 || scheduled.carbs > 0 || scheduled.fat > 0);
    const planned = hasScheduled
        ? shares({
              protein: protein + scheduled.protein,
              carbs: carbs + scheduled.carbs,
              fat: fat + scheduled.fat,
          })
        : null;

    return (
        <View>
            <View style={[styles.bar, { backgroundColor: colors.border }]}>
                {MACROS.map((macro, i) => (
                    <View key={macro} style={{ flex: now.kcal[i], backgroundColor: colors[macro] }} />
                ))}
            </View>
            <View style={styles.legend}>
                {MACROS.map((macro, i) => {
                    const diff = planned ? planned.percent[i] - now.percent[i] : 0;
                    return (
                        <View key={macro} style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: colors[macro] }]} />
                            <Text style={[styles.legendText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {t(`common.${macro}`)}{" "}
                                <Text style={[styles.legendValue, { color: colors.text }]}>{now.percent[i]}%</Text>
                                {planned && (
                                    <Text style={{ color: colors.textTertiary }}>
                                        {" "}{diff >= 0 ? "+" : ""}{diff}%
                                    </Text>
                                )}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: "row",
        height: 8,
        gap: 2,
        borderRadius: borderRadius.full,
        overflow: "hidden",
    },
    legend: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: spacing.xs, marginTop: spacing.sm },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    dot: { width: 7, height: 7, borderRadius: borderRadius.full },
    legendText: { fontSize: fontSize.xs },
    legendValue: { fontWeight: "600" },
});
