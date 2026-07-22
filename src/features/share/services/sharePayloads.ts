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
    /** Display name of whoever created the share (best-effort; sync username). */
    sharedBy?: string;
}

export interface SharedRecipeItem {
    food: SharedFood;
    quantity_grams: number;
    quantity_unit: string;
}

export interface RecipeSharePayload {
    name: string;
    items: SharedRecipeItem[];
    sharedBy?: string;
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
          /** Base template, per serving. Logging the original uses this × portion. */
          recipe: RecipeSharePayload;
          portion: number;
          meal_type: string;
          /**
           * Present only when this logged instance's entries diverged from the
           * template. Its items are the ACTUAL logged amounts (already scaled by
           * portion), so the importer diffs `scale(recipe, portion)` against it.
           */
          edited?: RecipeSharePayload;
      };

export interface LogSharePayload {
    items: SharedLogItem[];
    sharedBy?: string;
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

export function buildFoodPayload(food: Food, sharedBy?: string): FoodSharePayload {
    return { food: toSharedFood(food, getServingUnits(food.id)), sharedBy };
}

export function buildRecipePayload(recipeId: number, sharedBy?: string): RecipeSharePayload | null {
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
        sharedBy,
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
    sharedBy?: string,
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
                // The logged entries may have been edited after logging. Carry the
                // actual composition alongside the template so the recipient can
                // diff and choose which version to import.
                const actual: SharedRecipeItem[] = selected
                    .filter((r) => r.foods)
                    .map((r) => ({
                        food: toSharedFood(r.foods!, getServingUnits(r.foods!.id)),
                        quantity_grams: r.entries.quantity_grams,
                        quantity_unit: r.entries.quantity_unit ?? "g",
                    }));
                const baseScaled = scaleRecipeItems(recipe.items, recipeLog.portion);
                const edited = itemsSignature(actual) === itemsSignature(baseScaled)
                    ? undefined
                    : { name: recipe.name, items: actual };
                items.push({
                    type: "recipe",
                    recipe,
                    portion: recipeLog.portion,
                    meal_type: recipeLog.meal_type,
                    ...(edited ? { edited } : {}),
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

    return { items, sharedBy };
}

// ── Recipe scaling / signatures (edit detection + "already imported") ──

/** Multiplies each item's grams by `portion`, keeping foods and units. */
export function scaleRecipeItems(items: SharedRecipeItem[], portion: number): SharedRecipeItem[] {
    const p = Number.isFinite(portion) && portion > 0 ? portion : 1;
    return items.map((item) => ({ ...item, quantity_grams: item.quantity_grams * p }));
}

/**
 * Order-independent signature of a recipe's composition: each item as
 * (food identity, grams rounded to 3dp), sorted. Two recipes with the same
 * foods and quantities produce the same signature regardless of item order or
 * float noise, so it powers both edit detection and the "already imported"
 * check.
 */
export function itemsSignature(items: SharedRecipeItem[]): string {
    return JSON.stringify(
        items
            .map((item) => `${foodKey(item.food)}@${Math.round(item.quantity_grams * 1000) / 1000}`)
            .sort(),
    );
}

/**
 * Identity of a recipe as "the same recipe already in the library": its name
 * plus its composition. Used for the import screen's "already imported" check.
 */
export function recipeSignature(payload: RecipeSharePayload): string {
    return JSON.stringify([payload.name, itemsSignature(payload.items)]);
}

// ── Importers ──────────────────────────────────────────────

/**
 * Per-import dedupe caches. A payload embeds a food once per item that uses
 * it, so the same food (or the same recipe logged for two meals) appears
 * multiple times; without the cache each occurrence would create its own
 * template row.
 */
export interface ImportCache {
    foods: Map<string, Food>;
    recipes: Map<string, number>;
}

function newImportCache(): ImportCache {
    return { foods: new Map(), recipes: new Map() };
}

/** Identity of a shared food within one import: stable id, else full content. */
function foodKey(shared: SharedFood): string {
    if (shared.openfoodfacts_id) return `off:${shared.openfoodfacts_id}`;
    if (shared.barcode) return `bc:${shared.barcode}`;
    return (
        "c:" +
        JSON.stringify([
            shared.name,
            shared.calories_per_100g,
            shared.protein_per_100g,
            shared.carbs_per_100g,
            shared.fat_per_100g,
            shared.default_unit,
            shared.serving_size,
            (shared.serving_units ?? []).map((u) => [u.name, u.grams]),
        ])
    );
}

function recipeKey(payload: RecipeSharePayload): string {
    return JSON.stringify([
        payload.name,
        payload.items.map((item) => [foodKey(item.food), item.quantity_grams, item.quantity_unit]),
    ]);
}

/**
 * Reuses an existing food when a stable identifier matches, otherwise creates
 * one from the shared values (with numeric coercion so a malformed payload
 * cannot write NaN into the DB). Within one import, identical foods are
 * created once and reused via `cache`.
 */
export function findOrCreateFood(shared: SharedFood, cache: ImportCache = newImportCache()): Food {
    const key = foodKey(shared);
    const cached = cache.foods.get(key);
    if (cached) return cached;

    const found = lookupOrCreateFood(shared);
    cache.foods.set(key, found);
    return found;
}

function lookupOrCreateFood(shared: SharedFood): Food {
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

/**
 * Creates a new recipe (never merges into an existing one) and returns its
 * id. Within one import, identical recipes are created once and reused via
 * `cache`.
 */
export function importRecipePayload(
    payload: RecipeSharePayload,
    cache: ImportCache = newImportCache(),
): number {
    if (!payload?.name || !Array.isArray(payload.items)) {
        throw new Error("Invalid shared recipe.");
    }
    const key = recipeKey(payload);
    const cached = cache.recipes.get(key);
    if (cached !== undefined) return cached;

    const recipe = addRecipe(String(payload.name));
    for (const item of payload.items) {
        if (!item?.food) continue;
        const food = findOrCreateFood(item.food, cache);
        const grams = Number(item.quantity_grams);
        addRecipeItem({
            recipe_id: recipe.id,
            food_id: food.id,
            quantity_grams: Number.isFinite(grams) && grams > 0 ? grams : 0,
            quantity_unit: item.quantity_unit ? String(item.quantity_unit) : "g",
        });
    }
    cache.recipes.set(key, recipe.id);
    return recipe.id;
}

/**
 * Saves the edited composition of a shared recipe log as its own template and
 * logs a single instance of it. The edited items are absolute (already
 * portion-scaled), so it logs at portion 1. Returns the created recipe id.
 */
export function logEditedRecipeInstance(
    edited: RecipeSharePayload,
    dateKey: string,
    mealType: string,
    cache: ImportCache = newImportCache(),
): number {
    const recipeId = importRecipePayload(edited, cache);
    logRecipeToMeal(recipeId, mealType, dateKey, 1);
    return recipeId;
}

/** Creates the ImportCache the commit step threads through every decision. */
export function createImportCache(): ImportCache {
    return newImportCache();
}

/** Saves a shared food to the library and logs it at a specific amount/meal. */
export function logSharedFood(
    food: SharedFood,
    grams: number,
    unit: string,
    dateKey: string,
    mealType: string,
    cache: ImportCache = newImportCache(),
): void {
    const created = findOrCreateFood(food, cache);
    const g = Number(grams);
    const fallback = created.serving_size > 0 ? created.serving_size : 100;
    addEntry({
        food_id: created.id,
        quantity_grams: Number.isFinite(g) && g > 0 ? g : fallback,
        quantity_unit: unit ? String(unit) : "g",
        timestamp: Date.now(),
        date: dateKey,
        meal_type: mealType,
    });
}

/** Saves a shared recipe template and logs an instance at the given portion. */
export function logSharedRecipe(
    recipe: RecipeSharePayload,
    portion: number,
    dateKey: string,
    mealType: string,
    cache: ImportCache = newImportCache(),
): number {
    const recipeId = importRecipePayload(recipe, cache);
    const p = Number(portion);
    logRecipeToMeal(recipeId, mealType, dateKey, Number.isFinite(p) && p > 0 ? p : 1);
    return recipeId;
}
