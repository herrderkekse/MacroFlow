import PinnedCard from "@/src/shared/components/PinnedCard";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { MacroTotals } from "../hooks/useRecipeEditor";
import RecipeServingsRow from "./RecipeServingsRow";

interface RecipeMacroCardProps {
    perServing: MacroTotals;
    totals: MacroTotals;
    servings: number;
    onChangeServings: (value: number) => void;
    hasIngredients: boolean;
}

/**
 * The recipe at a glance, pinned under the header like the log's day card:
 * calories per serving with the macro split as a bar along its bottom edge.
 * Tapping it opens the grams per macro and how many servings it makes.
 */
export default function RecipeMacroCard({
    perServing, totals, servings, onChangeServings, hasIngredients,
}: RecipeMacroCardProps) {
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const format = (n: number) => Math.round(n).toLocaleString(i18n.language);

    const macros = [
        { key: "protein", label: t("common.protein"), grams: perServing.protein, kcal: perServing.protein * 4, color: colors.protein },
        { key: "carbs", label: t("common.carbs"), grams: perServing.carbs, kcal: perServing.carbs * 4, color: colors.carbs },
        { key: "fat", label: t("common.fat"), grams: perServing.fat, kcal: perServing.fat * 9, color: colors.fat },
    ];
    const macroKcal = macros.reduce((sum, m) => sum + m.kcal, 0);

    const summary = (
        <View style={styles.row}>
            <Text style={styles.calories} numberOfLines={1}>
                {format(perServing.calories)}
                <Text style={styles.unit}>{"  "}{t("templates.kcalPerServing")}</Text>
            </Text>
            <Text style={styles.side} numberOfLines={1}>
                {hasIngredients
                    ? t("templates.wholeRecipeTotal", { cal: format(totals.calories), servings })
                    : t("templates.addIngredientsForMacros")}
            </Text>
        </View>
    );

    // The macro split by energy, edge to edge — the card's divider, like the log's calorie bar.
    const bar = (
        <View style={styles.bar}>
            {macroKcal > 0 && macros.map((m) => (
                <View key={m.key} style={{ flex: m.kcal, backgroundColor: m.color }} />
            ))}
        </View>
    );

    const details = (
        <View style={styles.details}>
            {/* Wraps rather than squeezes, so "Kohlenhydrate" never truncates. */}
            <View style={styles.legend}>
                {macros.map((m) => (
                    <View key={m.key} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                        <Text style={styles.legendLabel}>
                            {m.label}{" "}
                            <Text style={styles.legendValue}>{Math.round(m.grams)} {t("common.g")}</Text>
                        </Text>
                    </View>
                ))}
            </View>
            <View style={styles.divider} />
            <RecipeServingsRow servings={servings} onChangeServings={onChangeServings} />
        </View>
    );

    return (
        <PinnedCard
            summary={summary}
            summaryFooter={bar}
            details={details}
            detailsLabel={t("templates.makes")}
        />
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
        calories: {
            flexShrink: 0,
            fontSize: fontSize.xl - 1,
            fontWeight: "600",
            letterSpacing: -0.5,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        unit: { fontSize: fontSize.xs, fontWeight: "400", letterSpacing: 0, color: colors.textTertiary },
        side: { flex: 1, textAlign: "right", fontSize: fontSize.xs, fontWeight: "500", color: colors.textTertiary },
        bar: { flexDirection: "row", gap: 2, height: 6, backgroundColor: colors.primaryLight },
        details: { gap: spacing.md },
        legend: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: spacing.xs },
        legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
        legendDot: { width: 7, height: 7, borderRadius: borderRadius.full },
        legendLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
        legendValue: { fontWeight: "600", color: colors.text },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    });
}
