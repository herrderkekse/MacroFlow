import logger from "@/src/utils/logger";
import type { FoodUnit } from "@/src/utils/units";
import { fromGrams, isValidUnit, toGrams } from "@/src/utils/units";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Keyboard } from "react-native";
import {
    addFood,
    addServingUnit,
    addRecipe,
    addRecipeItem,
    deleteRecipeItem,
    getFoodByBarcode,
    getFoodByOpenfoodfactsId,
    getRecipeById,
    getRecipeItems,
    getServingUnits,
    updateFood,
    updateRecipe,
    updateRecipeItem,
    updateRecipeServings,
    type ServingUnit,
} from "../services/templateDb";
import { useIngredientSearch, type UnsavedFood } from "./useIngredientSearch";

/**
 * One ingredient as it is being edited. Nothing here exists in the database
 * until the recipe is saved: `itemId` marks a row that was loaded from an
 * existing recipe, and a `food` with `id: 0` is a food that still has to be
 * created (a fresh OpenFoodFacts hit).
 */
export interface DraftIngredient {
    key: string;
    itemId?: number;
    food: UnsavedFood;
    quantityGrams: number;
    quantityUnit: string;
    servingUnits: ServingUnit[];
}

export interface MacroTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

const MAX_SERVINGS = 24;

let draftKeySeq = 0;
const nextDraftKey = () => `draft-${++draftKeySeq}`;

/** The draft's amount expressed in its own unit, e.g. 236.6 g → 1 cup. */
function amountInOwnUnit(draft: DraftIngredient): number {
    if (isValidUnit(draft.quantityUnit)) return fromGrams(draft.quantityGrams, draft.quantityUnit);
    const serving = draft.servingUnits.find((u) => u.name === draft.quantityUnit);
    return serving && serving.grams > 0 ? draft.quantityGrams / serving.grams : draft.quantityGrams;
}

/** Comparable shape of the whole editor, for the unsaved-changes check. */
function snapshot(name: string, servings: number, items: DraftIngredient[]): string {
    return JSON.stringify([
        name.trim(),
        servings,
        items.map((i) => [i.food.id, i.food.name, i.quantityGrams, i.quantityUnit]),
    ]);
}

export function useRecipeEditor() {
    const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
    const isEditing = !!recipeId;

    const [name, setName] = useState("");
    // Base recipe name when editing a variant (whose own name is just the
    // specification, e.g. "with sprinkles").
    const [baseName, setBaseName] = useState<string | null>(null);
    const [items, setItems] = useState<DraftIngredient[]>([]);
    const [servings, setServingsState] = useState(1);
    // Snapshot of the recipe as loaded, to tell edited from untouched.
    const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot("", 1, []));

    // The ingredient currently open in the amount sheet, and whether
    // confirming it appends a new row or updates an existing one.
    const [editing, setEditing] = useState<{ draft: DraftIngredient; isNew: boolean } | null>(null);

    /** A food was picked in the search sheet: open the amount sheet for it. */
    function openDraftForFood(food: UnsavedFood) {
        const foodUnit = (food.default_unit ?? "g") as FoodUnit;
        setEditing({
            isNew: true,
            draft: {
                key: nextDraftKey(),
                food,
                quantityGrams: toGrams(food.serving_size ?? 100, foodUnit),
                quantityUnit: foodUnit,
                // A food that is not in the library yet has no rows to read, but
                // an OpenFoodFacts import may have derived some for it already.
                servingUnits: food.id ? getServingUnits(food.id) : food.pendingServingUnits ?? [],
            },
        });
    }

    const search = useIngredientSearch(openDraftForFood);

    // ── Load existing recipe ──────────────────────────────
    useEffect(() => {
        if (!recipeId) return;
        queueMicrotask(() => {
            const recipe = getRecipeById(Number(recipeId));
            const drafts: DraftIngredient[] = getRecipeItems(Number(recipeId))
                .filter((row) => row.foods)
                .map((row) => ({
                    key: nextDraftKey(),
                    itemId: row.recipe_items.id,
                    food: row.foods!,
                    quantityGrams: row.recipe_items.quantity_grams,
                    quantityUnit: row.recipe_items.quantity_unit ?? "g",
                    servingUnits: getServingUnits(row.foods!.id),
                }));
            setItems(drafts);
            if (recipe) {
                setName(recipe.name);
                setServingsState(recipe.servings);
                const base = recipe.parent_recipe_id != null ? getRecipeById(recipe.parent_recipe_id) : undefined;
                setBaseName(base?.name ?? null);
                setSavedSnapshot(snapshot(recipe.name, recipe.servings, drafts));
            }
        });
    }, [recipeId]);

    function setServings(next: number) {
        setServingsState(Math.min(MAX_SERVINGS, Math.max(1, Math.round(next))));
    }

    // ── Ingredient drafts ─────────────────────────────────

    function editIngredient(draft: DraftIngredient) {
        Keyboard.dismiss();
        setEditing({ draft, isNew: false });
    }

    function closeEditing() {
        setEditing(null);
    }

    /** "Add to recipe" / "Update ingredient" in the amount sheet. */
    function commitEditing(quantityGrams: number, quantityUnit: string, servingUnits: ServingUnit[]) {
        if (!editing) return;
        const updated: DraftIngredient = { ...editing.draft, quantityGrams, quantityUnit, servingUnits };
        setItems((prev) =>
            editing.isNew
                ? [...prev, updated]
                : prev.map((i) => (i.key === updated.key ? updated : i)),
        );
        setEditing(null);
    }

    /** "Remove from recipe" in the amount sheet. */
    function removeEditing() {
        if (editing) setItems((prev) => prev.filter((i) => i.key !== editing.draft.key));
        setEditing(null);
    }

    // ── Saving ────────────────────────────────────────────

    /**
     * Resolves a draft's food to a row id, creating the food if it is new —
     * together with the serving units the draft has been carrying for it, which
     * could not be written without that id. A food that already exists keeps
     * the units it already has.
     */
    function materializeFood(food: UnsavedFood, servingUnits: ServingUnit[]): number {
        if (food.id) return food.id;
        const existing =
            (food.openfoodfacts_id ? getFoodByOpenfoodfactsId(food.openfoodfacts_id) : undefined)
            ?? (food.barcode ? getFoodByBarcode(food.barcode) : undefined);
        if (existing) return existing.id;
        const { id: _id, uuid: _uuid, pendingServingUnits: _pending, ...values } = food;
        const created = addFood(values);
        for (const unit of servingUnits) {
            addServingUnit({ food_id: created.id, name: unit.name, grams: unit.grams });
        }
        logger.info("[DB] Created food for recipe", { id: created.id, name: created.name });
        return created.id;
    }

    /**
     * The single point where the editor touches the database: creates or
     * updates the recipe and reconciles its items against the drafts.
     */
    function commit(): number {
        const id = recipeId
            ? Number(recipeId)
            : addRecipe(name.trim() || "Untitled recipe", servings).id;
        if (!recipeId) logger.info("[DB] Created recipe", { id });
        // A blank name field never overwrites the stored one.
        else if (name.trim()) updateRecipe(id, name.trim(), servings);
        else updateRecipeServings(id, servings);

        const staleItemIds = new Set(getRecipeItems(id).map((row) => row.recipe_items.id));
        for (const draft of items) {
            const foodId = materializeFood(draft.food, draft.servingUnits);
            const values = {
                food_id: foodId,
                quantity_grams: draft.quantityGrams,
                quantity_unit: draft.quantityUnit,
            };
            if (draft.itemId != null && staleItemIds.has(draft.itemId)) {
                updateRecipeItem(draft.itemId, values);
                staleItemIds.delete(draft.itemId);
            } else {
                addRecipeItem({ recipe_id: id, ...values });
            }
            // Remembered for the log screen's amount prefill, as before.
            updateFood(foodId, {
                last_logged_amount: amountInOwnUnit(draft),
                last_logged_unit: draft.quantityUnit,
            });
        }
        for (const staleId of staleItemIds) deleteRecipeItem(staleId);

        setSavedSnapshot(snapshot(name, servings, items));
        return id;
    }

    function handleSave() {
        commit();
        router.back();
    }

    /**
     * Saves, then hands off to the log screen with the recipe preselected —
     * the amount and meal are chosen there rather than guessed here.
     */
    function handleSaveAndLog() {
        router.replace({ pathname: "/log/add", params: { recipeId: String(commit()) } });
    }

    // ── Derived ───────────────────────────────────────────

    const totals: MacroTotals = items.reduce<MacroTotals>(
        (sum, { food, quantityGrams }) => {
            const factor = quantityGrams / 100;
            return {
                calories: sum.calories + food.calories_per_100g * factor,
                protein: sum.protein + food.protein_per_100g * factor,
                carbs: sum.carbs + food.carbs_per_100g * factor,
                fat: sum.fat + food.fat_per_100g * factor,
            };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const perServing: MacroTotals = {
        calories: totals.calories / servings,
        protein: totals.protein / servings,
        carbs: totals.carbs / servings,
        fat: totals.fat / servings,
    };

    const isDirty = useMemo(
        () => snapshot(name, servings, items) !== savedSnapshot,
        [name, servings, items, savedSnapshot],
    );

    return {
        isEditing,
        name,
        setName,
        baseName,
        items,
        servings,
        setServings,
        totals,
        perServing,
        canSave: items.length > 0,
        isDirty,
        ...search,
        editingDraft: editing?.draft ?? null,
        isNewItem: editing?.isNew ?? false,
        editIngredient,
        closeEditing,
        commitEditing,
        removeEditing,
        handleSave,
        handleSaveAndLog,
    };
}
