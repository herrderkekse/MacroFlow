import { getRecipeDisplayName } from "@/src/features/templates/services/recipeVariantsDb";
import { getRecipeItems, getServingUnits, type Recipe } from "@/src/features/templates/services/templateDb";
import { cancelMealReminderIfLogged } from "@/src/services/notifications";
import Button from "@/src/shared/atoms/Button";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import NutritionSummary from "@/src/shared/components/NutritionSummary";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import Sheet from "@/src/shared/components/Sheet";
import Stepper from "@/src/shared/components/Stepper";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import logger from "@/src/utils/logger";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatEntryQuantity } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatDateKey, logRecipeToMeal } from "../services/logDb";

interface RecipeLogSheetProps {
    recipe: Recipe | null;
    defaultMealType?: MealType;
    onClose: () => void;
    onSaved: () => void;
}

/** Logs a recipe: how many servings, for which meal. The recipe twin of EntrySheet. */
export default function RecipeLogSheet({
    recipe: openRecipe,
    defaultMealType,
    onClose,
    onSaved,
}: RecipeLogSheetProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const selectedDate = useAppStore((s) => s.selectedDate);
    const [mealType, setMealType] = useState<MealType>(defaultMealType ?? "breakfast");
    // Counted in servings of the recipe; `portion` (the stored multiplier of
    // the whole recipe) is derived from it.
    const [servingsInput, setServingsInput] = useState("1");

    // The last opened recipe stays on screen while the sheet slides out.
    const [shownRecipe, setShownRecipe] = useState(openRecipe);
    if (openRecipe && openRecipe !== shownRecipe) {
        setShownRecipe(openRecipe);
        setServingsInput("1");
    }
    const recipe = openRecipe ?? shownRecipe;

    React.useEffect(() => {
        if (defaultMealType) queueMicrotask(() => setMealType(defaultMealType));
    }, [defaultMealType]);

    const displayName = React.useMemo(() => (recipe ? getRecipeDisplayName(recipe) : null), [recipe]);

    const items = React.useMemo(() => (recipe ? getRecipeItems(recipe.id) : []), [recipe]);
    const servingUnitGramsByFoodId = React.useMemo(() => {
        const unitMap = new Map<number, Map<string, number>>();
        for (const row of items) {
            const foodId = row.foods?.id;
            if (!foodId || unitMap.has(foodId)) continue;
            unitMap.set(
                foodId,
                new Map(getServingUnits(foodId).map((servingUnit) => [servingUnit.name, servingUnit.grams])),
            );
        }
        return unitMap;
    }, [items]);

    const servingCount = Math.max(0, parseFloat(servingsInput.replace(",", ".")) || 0);
    const portion = servingCount / Math.max(1, recipe?.servings ?? 1);
    const totals = items.reduce(
        (sum, row) => {
            const food = row.foods;
            if (!food) return sum;
            const factor = (row.recipe_items.quantity_grams * portion) / 100;
            return {
                calories: sum.calories + food.calories_per_100g * factor,
                protein: sum.protein + food.protein_per_100g * factor,
                carbs: sum.carbs + food.carbs_per_100g * factor,
                fat: sum.fat + food.fat_per_100g * factor,
            };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    function handleSave(isScheduled = 0) {
        if (!recipe || portion <= 0) return;
        logRecipeToMeal(recipe.id, mealType, formatDateKey(selectedDate), portion, isScheduled);
        logger.info("[DB] Logged recipe to meal", {
            recipeId: recipe.id,
            mealType,
            date: formatDateKey(selectedDate),
            portionMultiplier: portion,
            isScheduled,
        });
        if (!isScheduled) cancelMealReminderIfLogged(mealType, true);
        onSaved();
    }

    return (
        <Sheet
            visible={!!openRecipe}
            onClose={onClose}
            title={displayName?.name ?? recipe?.name ?? ""}
            subtitle={displayName?.variant ?? undefined}
            footer={
                <View style={styles.footerRow}>
                    <Button
                        title={t("log.schedule")}
                        variant="outline"
                        icon={<Ionicons name="calendar-outline" size={17} color={colors.text} />}
                        onPress={() => handleSave(1)}
                        disabled={portion <= 0}
                        style={styles.footerButton}
                    />
                    <Button
                        title={t("log.addToLog")}
                        onPress={() => handleSave()}
                        disabled={portion <= 0}
                        style={styles.footerButton}
                    />
                </View>
            }
        >
            <FieldLabel style={styles.firstField}>{t("templates.servingsToLog")}</FieldLabel>
            <Stepper value={servingsInput} onChangeText={setServingsInput} step={0.25} min={0.25} />
            {recipe && recipe.servings > 1 && (
                <Text style={styles.hint}>{t("templates.recipeMakesServings", { count: recipe.servings })}</Text>
            )}

            <NutritionSummary
                calories={totals.calories}
                protein={totals.protein}
                carbs={totals.carbs}
                fat={totals.fat}
                style={styles.summary}
            />

            <FieldLabel>{t("log.meal")}</FieldLabel>
            <SegmentedControl<MealType>
                options={MEAL_TYPES.map((m) => ({ key: m.key, label: t(`meal.${m.key}`) }))}
                value={mealType}
                onChange={setMealType}
            />

            <FieldLabel>{t("common.itemCount", { count: items.length })}</FieldLabel>
            {items.map((row, index) => {
                const food = row.foods;
                const qty = row.recipe_items.quantity_grams * portion;
                const itemUnit = row.recipe_items.quantity_unit ?? "g";
                const servingGrams = food?.id
                    ? servingUnitGramsByFoodId.get(food.id)?.get(itemUnit)
                    : undefined;
                const cals = food ? Math.round((food.calories_per_100g * qty) / 100) : 0;
                return (
                    <View key={row.recipe_items.id} style={[styles.itemRow, index > 0 && styles.itemDivider]}>
                        <View style={styles.itemMain}>
                            <Text style={styles.itemName} numberOfLines={1}>
                                {food?.name ?? t("common.unknown")}
                            </Text>
                            <Text style={styles.itemDetail}>{formatEntryQuantity(qty, itemUnit, servingGrams)}</Text>
                        </View>
                        <Text style={styles.itemCalories}>{cals}</Text>
                    </View>
                );
            })}
            <View style={styles.bottomSpace} />
        </Sheet>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        firstField: { marginTop: 0 },
        hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.sm },
        summary: { marginTop: spacing.md },
        itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44, paddingVertical: spacing.xs + 2 },
        itemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        itemMain: { flex: 1 },
        itemName: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text },
        itemDetail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
        itemCalories: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
        footerRow: { flexDirection: "row", gap: spacing.sm },
        footerButton: { flex: 1 },
        bottomSpace: { height: spacing.md },
    });
}
