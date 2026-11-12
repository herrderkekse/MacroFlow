import Button from "@/src/shared/atoms/Button";
import AddPlaceholder from "@/src/shared/components/AddPlaceholder";
import FooterBar from "@/src/shared/components/FooterBar";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { MacroTotals } from "../hooks/useRecipeEditor";

interface RecipeMacroFooterProps {
    perServing: MacroTotals;
    totals: MacroTotals;
    servings: number;
    canSave: boolean;
    onSave: () => void;
    onSaveAndLog: () => void;
    onAddIngredient: () => void;
}

/**
 * Pinned at the bottom: "+ Add ingredient", what one serving contains, and
 * the two ways out of the editor.
 */
export default function RecipeMacroFooter({
    perServing,
    totals,
    servings,
    canSave,
    onSave,
    onSaveAndLog,
    onAddIngredient,
}: RecipeMacroFooterProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const macros = [
        { key: "protein", label: t("common.protein"), grams: perServing.protein, kcal: perServing.protein * 4, color: colors.protein },
        { key: "carbs", label: t("common.carbs"), grams: perServing.carbs, kcal: perServing.carbs * 4, color: colors.carbs },
        { key: "fat", label: t("common.fat"), grams: perServing.fat, kcal: perServing.fat * 9, color: colors.fat },
    ];
    const macroKcal = macros.reduce((sum, m) => sum + m.kcal, 0);

    return (
        <FooterBar>
            <AddPlaceholder label={t("templates.addIngredient")} onPress={onAddIngredient} style={styles.add} />
            <View style={styles.headline}>
                <Text style={styles.calValue}>
                    {Math.round(perServing.calories)}
                    <Text style={styles.calUnit}> {t("templates.kcalPerServing")}</Text>
                </Text>
                <Text style={styles.totalLine} numberOfLines={2}>
                    {canSave
                        ? t("templates.wholeRecipeTotal", { cal: Math.round(totals.calories), servings })
                        : t("templates.addIngredientsForMacros")}
                </Text>
            </View>

            <View style={styles.bar}>
                {macroKcal > 0 &&
                    macros.map((m) => (
                        <View key={m.key} style={{ flex: m.kcal, backgroundColor: m.color }} />
                    ))}
            </View>

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

            <View style={styles.actions}>
                <Button
                    title={t("templates.saveAndLog")}
                    variant="outline"
                    icon={<Ionicons name="today-outline" size={17} color={colors.text} />}
                    onPress={onSaveAndLog}
                    disabled={!canSave}
                    style={styles.action}
                />
                <Button title={t("templates.saveRecipe")} onPress={onSave} disabled={!canSave} style={styles.action} />
            </View>
        </FooterBar>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        add: { marginBottom: spacing.sm },
        headline: {
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: spacing.sm,
        },
        calValue: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            letterSpacing: -0.4,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        calUnit: { fontSize: fontSize.xs, fontWeight: "500", letterSpacing: 0, color: colors.textSecondary },
        totalLine: { flex: 1, textAlign: "right", fontSize: fontSize.xs, color: colors.textTertiary },
        bar: {
            flexDirection: "row",
            gap: 2,
            height: 8,
            borderRadius: borderRadius.full,
            overflow: "hidden",
            backgroundColor: colors.border,
        },
        legend: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: spacing.xs },
        legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
        legendDot: { width: 7, height: 7, borderRadius: borderRadius.full },
        legendLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
        legendValue: { fontWeight: "600", color: colors.text },
        actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
        action: { flex: 1 },
    });
}
