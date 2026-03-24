import Button from "@/src/components/Button";
import {
    formatDateKey,
    getRecipeItems,
    logRecipeToMeal,
    type Recipe,
} from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/types";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { type FoodUnit, formatQuantity, fromGrams } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface RecipeLogModalProps {
    recipe: Recipe | null;
    defaultMealType?: MealType;
    onClose: () => void;
    onSaved: () => void;
}

export default function RecipeLogModal({
    recipe,
    defaultMealType,
    onClose,
    onSaved,
}: RecipeLogModalProps) {
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const selectedDate = useAppStore((s) => s.selectedDate);
    const [mealType, setMealType] = useState<MealType>(defaultMealType ?? "breakfast");

    React.useEffect(() => {
        if (defaultMealType) setMealType(defaultMealType);
    }, [defaultMealType]);

    if (!recipe) return null;

    const items = getRecipeItems(recipe.id);
    const totalCals = items.reduce((sum, row) => {
        const food = row.foods;
        if (!food) return sum;
        return sum + (food.calories_per_100g * row.recipe_items.quantity_grams) / 100;
    }, 0);

    function handleSave() {
        if (!recipe) return;
        const group = `${recipe.id}-${Date.now()}`;
        logRecipeToMeal(recipe.id, mealType, formatDateKey(selectedDate), group);
        logger.info("[DB] Logged recipe to meal", {
            recipeId: recipe.id,
            mealType,
            date: formatDateKey(selectedDate),
        });
        onSaved();
    }

    return (
        <Modal
            visible={!!recipe}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Add Recipe</Text>
                <Pressable onPress={onClose} hitSlop={8}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.recipeName}>{recipe.name}</Text>
                <Text style={styles.summary}>
                    {items.length} item{items.length !== 1 ? "s" : ""} · {Math.round(totalCals)} cal
                </Text>

                {items.map((row) => {
                    const food = row.foods;
                    const qty = row.recipe_items.quantity_grams;
                    const itemUnit = (row.recipe_items.quantity_unit ?? "g") as FoodUnit;
                    const displayQty = fromGrams(qty, itemUnit);
                    const cals = food ? Math.round((food.calories_per_100g * qty) / 100) : 0;
                    return (
                        <View key={row.recipe_items.id} style={styles.itemRow}>
                            <Text style={styles.itemName} numberOfLines={1}>
                                {food?.name ?? "Unknown"}
                            </Text>
                            <Text style={styles.itemDetail}>{formatQuantity(Math.round(displayQty * 10) / 10, itemUnit)} · {cals} cal</Text>
                        </View>
                    );
                })}

                <Text style={styles.sectionLabel}>Meal</Text>
                <View style={styles.mealRow}>
                    {MEAL_TYPES.map((m) => (
                        <Pressable
                            key={m.key}
                            onPress={() => setMealType(m.key)}
                            style={[styles.mealChip, mealType === m.key && styles.mealChipActive]}
                        >
                            <Text
                                style={[styles.mealChipText, mealType === m.key && styles.mealChipTextActive]}
                            >
                                {m.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Button title="Add to Log" onPress={handleSave} style={styles.saveBtn} />
            </ScrollView>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        headerTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        content: { padding: spacing.lg },
        recipeName: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.xs,
        },
        summary: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        itemRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        itemName: { flex: 1, fontSize: fontSize.sm, color: colors.text, marginRight: spacing.sm },
        itemDetail: { fontSize: fontSize.xs, color: colors.textSecondary },
        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
        },
        mealRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        mealChip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        mealChipActive: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
        },
        mealChipText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        mealChipTextActive: {
            color: colors.primary,
            fontWeight: "600",
        },
        saveBtn: { marginTop: spacing.md },
    });
}
