import MacroInline from "@/src/shared/components/MacroInline";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface FoodRowProps {
    name: string;
    /** Nutrition per 100 g. Omit when the source has no nutrition facts at all. */
    nutrition?: { calories: number; protein: number; carbs: number; fat: number } | null;
    /** Marks a result that comes from OpenFoodFacts rather than the device. */
    isOnline?: boolean;
    /** Caveat about the item itself, e.g. an OFF product that was delisted. */
    warning?: string;
    onPress: () => void;
}

/**
 * The one search result for a food: name, macros and calories per 100 g.
 * Used wherever a food is picked — logging, and adding recipe ingredients.
 */
export default function FoodRow({ name, nutrition, isOnline = false, warning, onPress }: FoodRowProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
        >
            <View style={styles.main}>
                <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    {isOnline && <Ionicons name="globe-outline" size={13} color={colors.textTertiary} />}
                </View>
                {nutrition ? (
                    <MacroInline protein={nutrition.protein} carbs={nutrition.carbs} fat={nutrition.fat} style={styles.detail} />
                ) : (
                    <Text style={[styles.detail, styles.muted]}>{t("common.offNoNutrition")}</Text>
                )}
                {warning && (
                    <View style={styles.warning}>
                        <Ionicons name="warning-outline" size={12} color={colors.warning} />
                        <Text style={styles.warningText}>{warning}</Text>
                    </View>
                )}
            </View>
            {nutrition && (
                <View style={styles.energy}>
                    <Text style={styles.calories}>{Math.round(nutrition.calories)}</Text>
                    <Text style={styles.per}>{t("common.kcalPer100g")}</Text>
                </View>
            )}
            <Ionicons name="add" size={20} color={colors.textSecondary} />
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 4,
            minHeight: 60,
            paddingHorizontal: screenPadding,
            paddingVertical: spacing.sm + 2,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        main: { flex: 1 },
        nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        name: { flexShrink: 1, fontSize: fontSize.md, fontWeight: "500", color: colors.text },
        detail: { marginTop: 3 },
        muted: { fontSize: fontSize.xs, color: colors.textTertiary },
        warning: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
        warningText: { fontSize: fontSize.xs, color: colors.warning },
        energy: { alignItems: "flex-end" },
        calories: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
        per: { fontSize: fontSize.xxs, color: colors.textTertiary },
    });
}
