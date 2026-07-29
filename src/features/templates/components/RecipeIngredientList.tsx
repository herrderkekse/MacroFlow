import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatEntryQuantity } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DraftIngredient } from "../hooks/useRecipeEditor";

interface RecipeIngredientListProps {
    items: DraftIngredient[];
    onPressItem: (item: DraftIngredient) => void;
    onAdd: () => void;
}

/**
 * The ingredient card list, with the macro breakdown of every single row.
 * Its section heading is pinned by the screen, so it is not rendered here.
 */
export default function RecipeIngredientList({ items, onPressItem, onAdd }: RecipeIngredientListProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View>
            {items.length === 0 ? (
                <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                        <Ionicons name="restaurant-outline" size={24} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>{t("templates.emptyRecipeTitle")}</Text>
                    <Text style={styles.emptyBody}>{t("templates.emptyRecipeBody")}</Text>
                    <Pressable onPress={onAdd} style={styles.emptyBtn}>
                        <Ionicons name="search-outline" size={17} color="#FFFFFF" />
                        <Text style={styles.emptyBtnText}>{t("templates.addFirstIngredient")}</Text>
                    </Pressable>
                </View>
            ) : (
                <>
                    <View style={styles.card}>
                        {items.map((item, index) => (
                            <IngredientRow
                                key={item.key}
                                item={item}
                                isLast={index === items.length - 1}
                                onPress={() => onPressItem(item)}
                                styles={styles}
                                colors={colors}
                            />
                        ))}
                    </View>
                    <Pressable onPress={onAdd} style={styles.addBtn}>
                        <Ionicons name="search-outline" size={17} color={colors.primary} />
                        <Text style={styles.addBtnText}>{t("templates.addIngredient")}</Text>
                    </Pressable>
                </>
            )}
        </View>
    );
}

interface IngredientRowProps {
    item: DraftIngredient;
    isLast: boolean;
    onPress: () => void;
    styles: ReturnType<typeof createStyles>;
    colors: ThemeColors;
}

function IngredientRow({ item, isLast, onPress, styles, colors }: IngredientRowProps) {
    const { t } = useTranslation();
    const { food, servingUnits, quantityGrams, quantityUnit } = item;
    const servingGrams = servingUnits.find((s) => s.name === quantityUnit)?.grams;
    const factor = quantityGrams / 100;

    return (
        <Pressable onPress={onPress} style={[styles.row, !isLast && styles.rowDivider]}>
            <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                    {food.name || t("common.unknown")}
                </Text>
                <View style={styles.rowMacros}>
                    <Text style={styles.rowAmount}>
                        {formatEntryQuantity(quantityGrams, quantityUnit, servingGrams)}
                    </Text>
                    <View style={styles.dot} />
                    <Text style={[styles.rowCal, { color: colors.calories }]}>
                        {Math.round(food.calories_per_100g * factor)} {t("common.cal")}
                    </Text>
                    <Text style={[styles.rowMacro, { color: colors.protein }]}>
                        {Math.round(food.protein_per_100g * factor)}{t("common.g")}
                    </Text>
                    <Text style={[styles.rowMacro, { color: colors.carbs }]}>
                        {Math.round(food.carbs_per_100g * factor)}{t("common.g")}
                    </Text>
                    <Text style={[styles.rowMacro, { color: colors.fat }]}>
                        {Math.round(food.fat_per_100g * factor)}{t("common.g")}
                    </Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
        },
        rowDivider: {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        rowMain: { flex: 1 },
        rowName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        rowMacros: {
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginTop: spacing.xs,
        },
        rowAmount: { fontSize: fontSize.xs, fontWeight: "500", color: colors.textSecondary },
        dot: { width: 3, height: 3, borderRadius: 999, backgroundColor: colors.border },
        rowCal: { fontSize: fontSize.xs, fontWeight: "700" },
        rowMacro: { fontSize: fontSize.xs, fontWeight: "700" },
        addBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            marginTop: spacing.sm,
            padding: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: colors.border,
        },
        addBtnText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },
        empty: {
            alignItems: "center",
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        emptyIcon: {
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.sm,
        },
        emptyTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
        emptyBody: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.xs,
            maxWidth: 260,
        },
        emptyBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.md,
            paddingVertical: spacing.sm + 4,
            paddingHorizontal: spacing.lg,
            borderRadius: borderRadius.md,
            backgroundColor: colors.primary,
        },
        emptyBtnText: { fontSize: fontSize.sm, fontWeight: "700", color: "#FFFFFF" },
    });
}
