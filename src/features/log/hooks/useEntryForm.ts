import { getServingUnits, updateFood, type Food, type ServingUnit } from "@/src/features/templates/services/templateDb";
import { cancelMealReminderIfLogged } from "@/src/services/notifications";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { type MealType } from "@/src/shared/types";
import logger from "@/src/utils/logger";
import { fromGrams, toGrams, unitsForSystem, type FoodUnit } from "@/src/utils/units";
import React, { useMemo, useRef, useState } from "react";
import { addEntry, formatDateKey, getLoggedRecipeGroups, updateEntry, type Entry, type LoggedRecipeGroup } from "../services/logDb";

interface UseEntryFormOptions {
    food: Food | null;
    defaultMealType?: MealType;
    entry?: Entry | null;
    onClose: () => void;
    onSaved: () => void;
}

export function useEntryForm({ food, defaultMealType, entry, onClose, onSaved }: UseEntryFormOptions) {
    const selectedDate = useAppStore((s) => s.selectedDate);
    const unitSystem = useAppStore((s) => s.unitSystem);
    const [quantity, setQuantity] = useState("100");
    const [unit, setUnit] = useState<FoodUnit>("g");
    const [customServingUnit, setCustomServingUnit] = useState<ServingUnit | null>(null);
    const [foodServingUnits, setFoodServingUnits] = useState<ServingUnit[]>([]);
    const [mealType, setMealType] = useState<MealType>(
        defaultMealType ?? "breakfast",
    );
    const [recipeGroups, setRecipeGroups] = useState<LoggedRecipeGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<LoggedRecipeGroup | null>(null);
    const [portionMode, setPortionMode] = useState<"per-portion" | "total">("per-portion");
    const amountTouched = useRef(false);

    React.useEffect(() => {
        if (!food) {
            setRecipeGroups([]);
            setSelectedGroup(null);
            setFoodServingUnits([]);
            setCustomServingUnit(null);
            amountTouched.current = false;
            return;
        }

        setFoodServingUnits(food.id ? getServingUnits(food.id) : []);

        if (entry) {
            const entryUnit = (entry.quantity_unit ?? "g") as FoodUnit;
            const sUnits = food.id ? getServingUnits(food.id) : [];
            const matchServing = sUnits.find((s) => s.name === entry.quantity_unit);
            if (matchServing) {
                setCustomServingUnit(matchServing);
                setUnit("g");
                setQuantity(String(Math.round((entry.quantity_grams / matchServing.grams) * 10) / 10));
            } else {
                setCustomServingUnit(null);
                setUnit(entryUnit);
                setQuantity(String(Math.round(fromGrams(entry.quantity_grams, entryUnit) * 10) / 10));
            }
            setMealType(entry.meal_type as MealType);
            amountTouched.current = true;

            const groups = getLoggedRecipeGroups(entry.date, entry.meal_type);
            setRecipeGroups(groups);
            if (entry.recipe_log_id) {
                const match = groups.find((g) => g.recipeLogId === entry.recipe_log_id);
                setSelectedGroup(match ?? null);
            } else {
                setSelectedGroup(null);
            }
        } else {
            const sUnits = food.id ? getServingUnits(food.id) : [];
            if (food.last_logged_amount != null && food.last_logged_unit != null) {
                const lastUnit = food.last_logged_unit;
                const matchServing = sUnits.find((s) => s.name === lastUnit);
                if (matchServing) {
                    setCustomServingUnit(matchServing);
                    setUnit("g");
                } else {
                    setCustomServingUnit(null);
                    setUnit(lastUnit as FoodUnit);
                }
                setQuantity(String(food.last_logged_amount));
            } else {
                const defaultUnit = (food.default_unit ?? "g") as FoodUnit;
                setUnit(defaultUnit);
                setCustomServingUnit(null);
                setQuantity(String(food.serving_size ?? 100));
            }
            amountTouched.current = false;
            const meal = defaultMealType ?? (food.last_logged_meal as MealType | null) ?? "breakfast";
            setMealType(meal);

            const dateKey = formatDateKey(selectedDate);
            const groups = getLoggedRecipeGroups(dateKey, meal);
            setRecipeGroups(groups);
            setSelectedGroup(null);
        }
    }, [entry, food, defaultMealType, selectedDate]);

    React.useEffect(() => {
        if (!food) return;
        const dateKey = entry ? entry.date : formatDateKey(selectedDate);
        const groups = getLoggedRecipeGroups(dateKey, mealType);
        setRecipeGroups(groups);
        setSelectedGroup((prev) =>
            prev && groups.some((g) => g.recipeLogId === prev.recipeLogId) ? prev : null,
        );
    }, [mealType]); // eslint-disable-line react-hooks/exhaustive-deps

    const qty = parseFloat(quantity) || 0;
    const qtyGrams = customServingUnit ? qty * customServingUnit.grams : toGrams(qty, unit);

    const shouldApplyPortion =
        !entry && selectedGroup && selectedGroup.portion !== 1 && portionMode === "per-portion";
    const finalQtyGrams = shouldApplyPortion ? qtyGrams * selectedGroup.portion : qtyGrams;
    const previewQtyGrams = shouldApplyPortion ? finalQtyGrams : qtyGrams;

    const calculated = useMemo(() => {
        if (!food) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const factor = previewQtyGrams / 100;
        return {
            calories: food.calories_per_100g * factor,
            protein: food.protein_per_100g * factor,
            carbs: food.carbs_per_100g * factor,
            fat: food.fat_per_100g * factor,
        };
    }, [food, previewQtyGrams]);

    const savedUnit = customServingUnit ? customServingUnit.name : unit;

    function handleSave(isScheduled = 0) {
        if (!food || qty <= 0) return;

        if (entry) {
            updateEntry(entry.id, {
                quantity_grams: qtyGrams,
                quantity_unit: savedUnit,
                meal_type: mealType,
                recipe_log_id: selectedGroup?.recipeLogId ?? null,
            });
            logger.info("[DB] Updated entry", {
                id: entry.id,
                foodId: food.id,
                quantity: qtyGrams,
                unit: savedUnit,
                mealType: mealType,
                recipeLogId: selectedGroup?.recipeLogId,
            });
        } else {
            addEntry({
                food_id: food.id,
                quantity_grams: finalQtyGrams,
                quantity_unit: savedUnit,
                timestamp: Date.now(),
                date: formatDateKey(selectedDate),
                meal_type: mealType,
                recipe_log_id: selectedGroup?.recipeLogId,
                is_scheduled: isScheduled,
            });
            logger.info("[DB] Added entry", {
                foodId: food.id,
                quantity: finalQtyGrams,
                unit: savedUnit,
                date: formatDateKey(selectedDate),
                mealType: mealType,
                recipeLogId: selectedGroup?.recipeLogId,
                isScheduled,
            });

            updateFood(food.id, {
                last_logged_amount: qty,
                last_logged_unit: savedUnit,
                last_logged_meal: mealType,
            });

            cancelMealReminderIfLogged(mealType as MealType, true);
        }

        setQuantity("100");
        onSaved();
    }

    function handleServingUnitCreated(saved: ServingUnit) {
        setFoodServingUnits(food?.id ? getServingUnits(food.id) : []);
        setCustomServingUnit(saved);
        if (!amountTouched.current) setQuantity("1");
    }

    function handleClose() {
        setQuantity("100");
        onClose();
    }

    const unitOptions = unitsForSystem(unitSystem);

    return {
        quantity,
        setQuantity,
        unit,
        setUnit,
        customServingUnit,
        setCustomServingUnit,
        foodServingUnits,
        mealType,
        setMealType,
        recipeGroups,
        selectedGroup,
        setSelectedGroup,
        portionMode,
        setPortionMode,
        amountTouched,
        qty,
        qtyGrams,
        finalQtyGrams,
        calculated,
        unitOptions,
        handleSave,
        handleServingUnitCreated,
        handleClose,
    };
}
