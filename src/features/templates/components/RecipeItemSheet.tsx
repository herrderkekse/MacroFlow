import Button from "@/src/shared/atoms/Button";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import NutritionSummary from "@/src/shared/components/NutritionSummary";
import Sheet from "@/src/shared/components/Sheet";
import Stepper from "@/src/shared/components/Stepper";
import UnitPicker from "@/src/shared/components/UnitPicker";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { spacing } from "@/src/utils/theme";
import { fromGrams, toGrams, unitLabel, unitsForSystem, type FoodUnit } from "@/src/utils/units";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import type { DraftIngredient } from "../hooks/useRecipeEditor";
import { addServingUnit, getServingUnits, type ServingUnit } from "../services/templateDb";

interface RecipeItemSheetProps {
    /** The ingredient being edited; null keeps the sheet closed. */
    draft: DraftIngredient | null;
    /** True while the ingredient is being added rather than re-edited. */
    isNew: boolean;
    onClose: () => void;
    onConfirm: (quantityGrams: number, unit: string, servingUnits: ServingUnit[]) => void;
    onRemove: () => void;
}

/**
 * Amount + unit sheet for one ingredient, with its macros updating live.
 * Purely a form: the chosen amount is handed back to the editor and only
 * reaches the database when the recipe itself is saved.
 */
export default function RecipeItemSheet({
    draft,
    isNew,
    onClose,
    onConfirm,
    onRemove,
}: RecipeItemSheetProps) {
    const { t } = useTranslation();
    const unitSystem = useAppStore((s) => s.unitSystem);

    const [quantity, setQuantity] = useState("100");
    const [unit, setUnit] = useState<FoodUnit>("g");
    const [customServingUnit, setCustomServingUnit] = useState<ServingUnit | null>(null);
    const [foodServingUnits, setFoodServingUnits] = useState<ServingUnit[]>([]);

    React.useEffect(() => {
        if (!draft) return;
        queueMicrotask(() => {
            setFoodServingUnits(draft.servingUnits);
            const matchServing = draft.servingUnits.find((s) => s.name === draft.quantityUnit);
            if (matchServing) {
                setCustomServingUnit(matchServing);
                setUnit("g");
                setQuantity(String(Math.round((draft.quantityGrams / matchServing.grams) * 10) / 10));
            } else {
                setCustomServingUnit(null);
                const itemUnit = (draft.quantityUnit ?? "g") as FoodUnit;
                setUnit(itemUnit);
                setQuantity(String(Math.round(fromGrams(draft.quantityGrams, itemUnit) * 10) / 10));
            }
        });
    }, [draft]);

    const food = draft?.food ?? null;
    const qty = parseFloat(quantity) || 0;
    const qtyGrams = customServingUnit ? qty * customServingUnit.grams : toGrams(qty, unit);

    const calculated = useMemo(() => {
        if (!food) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const factor = qtyGrams / 100;
        return {
            calories: food.calories_per_100g * factor,
            protein: food.protein_per_100g * factor,
            carbs: food.carbs_per_100g * factor,
            fat: food.fat_per_100g * factor,
        };
    }, [food, qtyGrams]);

    // Grams and millilitres move in coarser steps than "1 cup" or "1 patty".
    const step = !customServingUnit && (unit === "g" || unit === "ml") ? 10 : 0.5;

    /** Keeps the same real amount when the unit changes, e.g. 100 g → 3.5 oz. */
    function convertTo(nextUnit: FoodUnit) {
        setCustomServingUnit(null);
        setUnit(nextUnit);
        setQuantity(String(Math.round(fromGrams(qtyGrams, nextUnit) * 100) / 100));
    }

    function selectServingUnit(su: ServingUnit) {
        setCustomServingUnit(su);
        setQuantity(String(Math.round((qtyGrams / su.grams) * 100) / 100));
    }

    function handleConfirm() {
        if (!draft || qty <= 0) return;
        onConfirm(qtyGrams, customServingUnit ? customServingUnit.name : unit, foodServingUnits);
    }

    const unitOptions = unitsForSystem(unitSystem);

    return (
        <Sheet
            visible={!!draft}
            onClose={onClose}
            title={food?.name ?? ""}
            subtitle={t("log.per100g", { calories: Math.round(food?.calories_per_100g ?? 0) })}
            footer={
                <>
                    <Button
                        title={isNew ? t("templates.addToRecipe") : t("templates.updateIngredient")}
                        onPress={handleConfirm}
                        disabled={qty <= 0}
                    />
                    {!isNew && (
                        <Button title={t("templates.removeFromRecipe")} variant="danger" onPress={onRemove} />
                    )}
                </>
            }
        >
            <FieldLabel style={styles.firstField}>{t("log.quantity")}</FieldLabel>
            <Stepper
                value={quantity}
                onChangeText={(v) => setQuantity(v.replace(/[^0-9.]/g, ""))}
                step={step}
                suffix={customServingUnit ? customServingUnit.name : unitLabel(unit)}
            />

            <FieldLabel>{t("log.unit")}</FieldLabel>
            <UnitPicker
                unitOptions={unitOptions}
                selectedUnit={unit}
                onSelectUnit={convertTo}
                servingUnits={foodServingUnits}
                selectedServingUnit={customServingUnit}
                onSelectServingUnit={selectServingUnit}
                onAddServingUnit={food?.id ? (name, grams) => addServingUnit({ food_id: food.id, name, grams }) : undefined}
                onServingUnitCreated={(saved) => {
                    setFoodServingUnits(food?.id ? getServingUnits(food.id) : []);
                    setCustomServingUnit(saved);
                    setQuantity("1");
                }}
            />

            <NutritionSummary
                caption={t("templates.thisIngredient")}
                calories={calculated.calories}
                protein={calculated.protein}
                carbs={calculated.carbs}
                fat={calculated.fat}
                style={styles.summary}
            />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    firstField: { marginTop: 0 },
    summary: { marginTop: spacing.md, marginBottom: spacing.md },
});
