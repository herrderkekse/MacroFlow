// Portable payload shapes for shared foods, recipes, and log selections
// (version 1), plus the builders that produce them from local rows and the
// importers that write them back into the local DB. Foods travel embedded in
// full (macros + serving units) because the recipient likely doesn't have
// them; on import an existing food is reused only when a stable identifier
// (OpenFoodFacts id or barcode) matches, otherwise a new row is created —
// imports never overwrite existing data.

import {
    addEntry,
    getRecipeLogById,
    logRecipeToMeal,
    type EntryWithFood,
} from "@/src/features/log/services/logDb";
import {
    addFood,
    addRecipe,
    addRecipeItem,
    addServingUnit,
    getFoodByBarcode,
    getFoodByOpenfoodfactsId,
    getRecipeById,
    getRecipeItems,
    getServingUnits,
    type Food,
    type ServingUnit,
} from "@/src/features/templates/services/templateDb";

// ── Payload shapes (version 1) ─────────────────────────────

export interface SharedServingUnit {
    name: string;
    grams: number;
}

export interface SharedFood {
    name: string;
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
    barcode?: string | null;
    openfoodfacts_id?: string | null;
    default_unit?: string;
    serving_size?: number;
    serving_units?: SharedServingUnit[];
}

export interface FoodSharePayload {
    food: SharedFood;
}

export interface SharedRecipeItem {
    food: SharedFood;
    quantity_grams: number;
    quantity_unit: string;
}

export interface RecipeSharePayload {
    name: string;
    items: SharedRecipeItem[];
}

export type SharedLogItem =
    | {
          type: "food";
          food: SharedFood;
          quantity_grams: number;
          quantity_unit: string;
          meal_type: string;
      }
    | {
          type: "recipe";
          recipe: RecipeSharePayload;
          portion: number;
          meal_type: string;
      };

export interface LogSharePayload {
    items: SharedLogItem[];
}

// ── Builders ───────────────────────────────────────────────

function toSharedFood(food: Food, units: ServingUnit[]): SharedFood {
    return {
        name: food.name,
        calories_per_100g: food.calories_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
        barcode: food.barcode,
        openfoodfacts_id: food.openfoodfacts_id,
        default_unit: food.default_unit,
        serving_size: food.serving_size,
        serving_units: units.map((u) => ({ name: u.name, grams: u.grams })),
    };
}

export function buildFoodPayload(food: Food): FoodSharePayload {
    return { food: toSharedFood(food, getServingUnits(food.id)) };
}

export function buildRecipePayload(recipeId: number): RecipeSharePayload | null {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return null;
    const rows = getRecipeItems(recipeId);
    return {
        name: recipe.name,
        items: rows
            .filter((row) => row.foods)
            .map((row) => ({
                food: toSharedFood(row.foods!, getServingUnits(row.foods!.id)),
                quantity_grams: row.recipe_items.quantity_grams,
                quantity_unit: row.recipe_items.quantity_unit ?? "g",
            })),
    };
}

/**
 * Bundles the log screen's selection. A recipe log whose entries are all
 * selected travels as a recipe (template + portion) so the recipient can
 * re-log or save it; partially-selected recipe entries and standalone entries
 * travel as plain food items.
 */
export function buildLogSelectionPayload(
    allRows: EntryWithFood[],
    selectedIds: Set<number>,
): LogSharePayload {
    const items: SharedLogItem[] = [];
    const foodRows: EntryWithFood[] = [];

    const byRecipeLog = new Map<number, EntryWithFood[]>();
    for (const row of allRows) {
        const rlId = row.entries.recipe_log_id;
        if (!rlId) continue;
        const list = byRecipeLog.get(rlId) ?? [];
        list.push(row);
        byRecipeLog.set(rlId, list);
    }

    for (const [rlId, rows] of byRecipeLog) {
        const selected = rows.filter((r) => selectedIds.has(r.entries.id));
        if (selected.length === 0) continue;
        if (selected.length === rows.length) {
            const recipeLog = getRecipeLogById(rlId);
            const recipe = recipeLog ? buildRecipePayload(recipeLog.recipe_id) : null;
            if (recipeLog && recipe) {
                items.push({
                    type: "recipe",
                    recipe,
                    portion: recipeLog.portion,
                    meal_type: recipeLog.meal_type,
                });
                continue;
            }
        }
        foodRows.push(...selected);
    }

    for (const row of allRows) {
        if (!row.entries.recipe_log_id && selectedIds.has(row.entries.id)) {
            foodRows.push(row);
        }
    }

    for (const row of foodRows) {
        if (!row.foods) continue;
        items.push({
            type: "food",
            food: toSharedFood(row.foods, getServingUnits(row.foods.id)),
            quantity_grams: row.entries.quantity_grams,
            quantity_unit: row.entries.quantity_unit,
            meal_type: row.entries.meal_type,
        });
    }

    return { items };
}

// ── Importers ──────────────────────────────────────────────

/**
 * Reuses an existing food when a stable identifier matches, otherwise creates
 * one from the shared values (with numeric coercion so a malformed payload
 * cannot write NaN into the DB).
 */
export function findOrCreateFood(shared: SharedFood): Food {
    if (shared.openfoodfacts_id) {
        const existing = getFoodByOpenfoodfactsId(String(shared.openfoodfacts_id));
        if (existing && !existing.deleted) return existing;
    }
    if (shared.barcode) {
        const existing = getFoodByBarcode(String(shared.barcode));
        if (existing && !existing.deleted) return existing;
    }

    const num = (v: unknown, fallback = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
    };
    const created = addFood({
        name: String(shared.name ?? "").trim() || "Shared food",
        calories_per_100g: num(shared.calories_per_100g),
        protein_per_100g: num(shared.protein_per_100g),
        carbs_per_100g: num(shared.carbs_per_100g),
        fat_per_100g: num(shared.fat_per_100g),
        barcode: shared.barcode ? String(shared.barcode) : null,
        openfoodfacts_id: shared.openfoodfacts_id ? String(shared.openfoodfacts_id) : null,
        source: "manual",
        default_unit: shared.default_unit ? String(shared.default_unit) : "g",
        serving_size: num(shared.serving_size, 100) || 100,
    });
    for (const unit of shared.serving_units ?? []) {
        const grams = num(unit.grams);
        const name = String(unit.name ?? "").trim();
        if (!name || grams <= 0) continue;
        addServingUnit({ food_id: created.id, name, grams });
    }
    return created;
}

export function importFoodPayload(payload: FoodSharePayload): Food {
    if (!payload?.food) throw new Error("Invalid shared food.");
    return findOrCreateFood(payload.food);
}

/** Creates a new recipe (never merges into an existing one) and returns its id. */
export function importRecipePayload(payload: RecipeSharePayload): number {
    if (!payload?.name || !Array.isArray(payload.items)) {
        throw new Error("Invalid shared recipe.");
    }
    const recipe = addRecipe(String(payload.name));
    for (const item of payload.items) {
        if (!item?.food) continue;
        const food = findOrCreateFood(item.food);
        const grams = Number(item.quantity_grams);
        addRecipeItem({
            recipe_id: recipe.id,
            food_id: food.id,
            quantity_grams: Number.isFinite(grams) && grams > 0 ? grams : 0,
            quantity_unit: item.quantity_unit ? String(item.quantity_unit) : "g",
        });
    }
    return recipe.id;
}

/** Saves everything a log share contains into the library, without logging. */
export function importLogPayloadToLibrary(payload: LogSharePayload): void {
    for (const item of validLogItems(payload)) {
        if (item.type === "food") findOrCreateFood(item.food);
        else importRecipePayload(item.recipe);
    }
}

/**
 * Saves a log share into the library and logs each item to `dateKey`, keeping
 * every item's original meal.
 */
export function importLogPayloadToLog(payload: LogSharePayload, dateKey: string): void {
    for (const item of validLogItems(payload)) {
        if (item.type === "food") {
            const food = findOrCreateFood(item.food);
            const grams = Number(item.quantity_grams);
            addEntry({
                food_id: food.id,
                quantity_grams: Number.isFinite(grams) && grams > 0 ? grams : 0,
                quantity_unit: item.quantity_unit ? String(item.quantity_unit) : "g",
                timestamp: Date.now(),
                date: dateKey,
                meal_type: normalizeMeal(item.meal_type),
            });
        } else {
            const recipeId = importRecipePayload(item.recipe);
            const portion = Number(item.portion);
            logRecipeToMeal(
                recipeId,
                normalizeMeal(item.meal_type),
                dateKey,
                Number.isFinite(portion) && portion > 0 ? portion : 1,
            );
        }
    }
}

/** Logs an already-imported food as one serving of its default size. */
export function logImportedFood(food: Food, dateKey: string, mealType: string): void {
    addEntry({
        food_id: food.id,
        quantity_grams: food.serving_size > 0 ? food.serving_size : 100,
        quantity_unit: "g",
        timestamp: Date.now(),
        date: dateKey,
        meal_type: mealType,
    });
}

/** Logs an already-imported recipe at portion 1. */
export function logImportedRecipe(recipeId: number, dateKey: string, mealType: string): void {
    logRecipeToMeal(recipeId, mealType, dateKey, 1);
}

function validLogItems(payload: LogSharePayload): SharedLogItem[] {
    if (!Array.isArray(payload?.items)) throw new Error("Invalid shared log.");
    return payload.items.filter(
        (item) => (item?.type === "food" && item.food) || (item?.type === "recipe" && item.recipe),
    );
}

const MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);

function normalizeMeal(meal: unknown): string {
    return MEALS.has(String(meal)) ? String(meal) : "snack";
}
