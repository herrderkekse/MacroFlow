import EmptyState from "@/src/shared/atoms/EmptyState";
import MacroNumbers from "@/src/shared/components/MacroNumbers";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatEntryQuantity } from "@/src/utils/units";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DraftIngredient } from "../hooks/useRecipeEditor";

interface RecipeIngredientListProps {
    items: DraftIngredient[];
    onPressItem: (item: DraftIngredient) => void;
}

/**
 * The recipe's ingredients as a card of rows, like the meals of the log:
 * name and amount, then calories and macros. Its heading and the add button
 * are rendered by the screen, so neither is here.
 */
export default function RecipeIngredientList({ items, onPressItem }: RecipeIngredientListProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    if (items.length === 0) {
        return <EmptyState icon="restaurant-outline" title={t("templates.noIngredients")} style={styles.empty} />;
    }

    return (
        <View style={styles.card}>
            {items.map((item, index) => (
                <IngredientRow
                    key={item.key}
                    item={item}
                    isFirst={index === 0}
                    onPress={() => onPressItem(item)}
                    styles={styles}
                />
            ))}
        </View>
    );
}

interface IngredientRowProps {
    item: DraftIngredient;
    isFirst: boolean;
    onPress: () => void;
    styles: ReturnType<typeof createStyles>;
}

function IngredientRow({ item, isFirst, onPress, styles }: IngredientRowProps) {
    const { t } = useTranslation();
    const { food, servingUnits, quantityGrams, quantityUnit } = item;
    const servingGrams = servingUnits.find((s) => s.name === quantityUnit)?.grams;
    const factor = quantityGrams / 100;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.row, !isFirst && styles.divider, pressed && styles.pressed]}
            accessibilityRole="button"
        >
            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{food.name || t("common.unknown")}</Text>
                <Text style={styles.amount} numberOfLines={1}>
                    {formatEntryQuantity(quantityGrams, quantityUnit, servingGrams)}
                </Text>
            </View>
            <MacroNumbers
                calories={food.calories_per_100g * factor}
                protein={food.protein_per_100g * factor}
                carbs={food.carbs_per_100g * factor}
                fat={food.fat_per_100g * factor}
                style={styles.numbers}
            />
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 3,
            paddingVertical: spacing.sm + 4,
            paddingHorizontal: spacing.md,
        },
        divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed: { backgroundColor: colors.surfaceMuted },
        info: { flex: 1, minWidth: 0 },
        name: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        amount: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
        numbers: { alignSelf: "flex-start", marginTop: 1 },
        // Centred in the space the list would fill (the scroll content grows to the footer).
        empty: { flex: 1, justifyContent: "center", paddingVertical: spacing.xl },
    });
}
