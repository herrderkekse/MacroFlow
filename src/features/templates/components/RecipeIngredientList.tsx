import Button from "@/src/shared/atoms/Button";
import Card from "@/src/shared/atoms/Card";
import EmptyState from "@/src/shared/atoms/EmptyState";
import MacroInline from "@/src/shared/components/MacroInline";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
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
                <Card>
                    <EmptyState
                        icon="restaurant-outline"
                        title={t("templates.emptyRecipeTitle")}
                        message={t("templates.emptyRecipeBody")}
                        style={styles.empty}
                        action={
                            <Button
                                title={t("templates.addFirstIngredient")}
                                icon={<Ionicons name="search-outline" size={17} color={colors.onPrimary} />}
                                onPress={onAdd}
                                style={styles.emptyBtn}
                            />
                        }
                    />
                </Card>
            ) : (
                <>
                    <Card padded={false}>
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
                    </Card>
                    <Button
                        title={t("templates.addIngredient")}
                        variant="outline"
                        icon={<Ionicons name="add" size={18} color={colors.text} />}
                        onPress={onAdd}
                        style={styles.addBtn}
                    />
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
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}
            accessibilityRole="button"
        >
            <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                    {food.name || t("common.unknown")}
                </Text>
                <View style={styles.rowDetail}>
                    <Text style={styles.rowAmount}>
                        {formatEntryQuantity(quantityGrams, quantityUnit, servingGrams)}
                    </Text>
                    <MacroInline
                        protein={food.protein_per_100g * factor}
                        carbs={food.carbs_per_100g * factor}
                        fat={food.fat_per_100g * factor}
                    />
                </View>
            </View>
            <Text style={styles.rowCal}>{Math.round(food.calories_per_100g * factor)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: 60,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
        },
        rowDivider: {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        rowMain: { flex: 1 },
        rowName: { fontSize: fontSize.md, fontWeight: "500", color: colors.text },
        rowDetail: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: spacing.sm + 4, marginTop: 3 },
        rowAmount: { fontSize: fontSize.xs, color: colors.textSecondary },
        rowCal: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
        addBtn: { marginTop: spacing.sm + 4 },
        empty: { paddingVertical: spacing.md },
        emptyBtn: { marginTop: spacing.sm, alignSelf: "stretch" },
    });
}
