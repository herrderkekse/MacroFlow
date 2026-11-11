import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface NutritionSummaryProps {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** Small caption above the calories, e.g. "per serving". */
    caption?: string;
    style?: StyleProp<ViewStyle>;
}

const MACROS = ["protein", "carbs", "fat"] as const;

function formatGrams(value: number) {
    return value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

/**
 * The one "what does this amount contain" panel: calories on the left, the
 * three macros in their colours on the right. Shown wherever an amount is
 * being chosen (logging an entry, a recipe, an ingredient).
 */
export default function NutritionSummary({ calories, protein, carbs, fat, caption, style }: NutritionSummaryProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const values = { protein, carbs, fat };

    return (
        <View style={[styles.container, style]}>
            <View style={styles.energy}>
                {caption ? <Text style={styles.label} numberOfLines={1}>{caption}</Text> : null}
                <Text style={styles.calories}>
                    {Math.round(calories)}
                    <Text style={styles.caloriesUnit}> {t("common.kcal")}</Text>
                </Text>
            </View>
            {MACROS.map((macro) => (
                <View key={macro} style={styles.macro}>
                    <Text style={[styles.macroValue, { color: colors[macro] }]}>
                        {formatGrams(values[macro])}
                        <Text style={styles.macroUnit}> {t("common.g")}</Text>
                    </Text>
                    <Text style={styles.label} numberOfLines={1}>{t(`common.${macro}`)}</Text>
                </View>
            ))}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm + 4,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        energy: { flex: 1 },
        calories: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            letterSpacing: -0.4,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        caloriesUnit: { fontSize: fontSize.xs, fontWeight: "500", letterSpacing: 0, color: colors.textSecondary },
        macro: { alignItems: "flex-end" },
        macroValue: { fontSize: fontSize.sm, fontWeight: "700", fontVariant: ["tabular-nums"] },
        macroUnit: { fontSize: fontSize.xxs, fontWeight: "500" },
        label: { fontSize: fontSize.xxs, color: colors.textSecondary, marginTop: 1 },
    });
}
