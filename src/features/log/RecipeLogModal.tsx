import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
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
    const [portionInput, setPortionInput] = useState("1");

    React.useEffect(() => {
        if (defaultMealType) setMealType(defaultMealType);
    }, [defaultMealType]);

    React.useEffect(() => {
        if (recipe) setPortionInput("1");
    }, [recipe]);

    if (!recipe) return null;

    const portion = Math.max(0, parseFloat(portionInput) || 0);

    const items = getRecipeItems(recipe.id);
    const totalCals = items.reduce((sum, row) => {
        const food = row.foods;
        if (!food) return sum;
        return sum + (food.calories_per_100g * row.recipe_items.quantity_grams) / 100;
    }, 0) * portion;

    function handleSave() {
        if (!recipe || portion <= 0) return;
        logRecipeToMeal(recipe.id, mealType, formatDateKey(selectedDate), portion);
        logger.info("[DB] Logged recipe to meal", {
            recipeId: recipe.id,
            mealType,
            date: formatDateKey(selectedDate),
            portionMultiplier: portion,
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
            <View style={styles.container}>
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

                    {/* Portion multiplier */}
                    <Text style={styles.sectionLabel}>Portions</Text>
                    <View style={styles.portionRow}>
                        <Pressable
                            onPress={() => {
                                const v = Math.max(0.25, (parseFloat(portionInput) || 1) - 0.25);
                                setPortionInput(String(Math.round(v * 100) / 100));
                            }}
                            style={styles.portionBtn}
                        >
                            <Ionicons name="remove" size={20} color={colors.primary} />
                        </Pressable>
                        <Input
                            value={portionInput}
                            onChangeText={setPortionInput}
                            keyboardType="decimal-pad"
                            containerStyle={styles.portionInput}
                            style={styles.portionInputText}
                        />
                        <Pressable
                            onPress={() => {
                                const v = (parseFloat(portionInput) || 1) + 0.25;
                                setPortionInput(String(Math.round(v * 100) / 100));
                            }}
                            style={styles.portionBtn}
                        >
                            <Ionicons name="add" size={20} color={colors.primary} />
                        </Pressable>
                    </View>

                    {items.map((row) => {
                        const food = row.foods;
                        const qty = row.recipe_items.quantity_grams * portion;
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
            </View>
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
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, backgroundColor: colors.background },
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
        portionRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        portionBtn: {
            width: 40,
            height: 40,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },
        portionInput: {
            flex: 1,
            marginBottom: 0,
        },
        portionInputText: {
            textAlign: "center",
            fontSize: fontSize.lg,
            fontWeight: "700",
        },
    });
}
