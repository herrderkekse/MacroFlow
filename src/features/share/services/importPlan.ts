// Turns a fetched share into a queue of slides the import screen walks through,
// and turns the user's per-slide choices into deferred decisions that only
// touch the DB when `commitImportPlan` runs on the final confirm. Nothing here
// writes to the DB except `commitImportPlan`; because of that, the library is a
// stable snapshot for the whole session, so "already imported" flags computed
// while building the queue stay valid until commit.

import { getAllRecipes } from "@/src/features/templates/services/templateDb";
import type { FetchedShare } from "./shareClient";
import {
    buildRecipePayload,
    createImportCache,
    findOrCreateFood,
    importRecipePayload,
    logEditedRecipeInstance,
    logSharedFood,
    logSharedRecipe,
    recipeSignature,
    scaleRecipeItems,
    type FoodSharePayload,
    type ImportCache,
    type LogSharePayload,
    type RecipeSharePayload,
    type SharedFood,
    type SharedRecipeItem,
} from "./sharePayloads";

// ── Public types ───────────────────────────────────────────

export interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export type DiffType = "same" | "added" | "removed" | "changed";

export interface DiffRow {
    name: string;
    type: DiffType;
    qtyText: string;
}

export interface FoodBatchItem {
    id: string;
    food: SharedFood;
    title: string;
    /** Grams the row previews (logged amount, else the food's serving size). */
    grams: number;
    unit: string;
    macros: Macros;
    /** Came from a shared log entry → defaults to being logged at its meal. */
    fromLog: boolean;
    meal: string;
}

export interface RecipeSlide {
    type: "recipe";
    id: string;
    title: string;
    /** Came from a logged instance (carries an original meal) vs. a bare template. */
    isEntry: boolean;
    originalMeal: string;
    isEdited: boolean;
    /** Base template, per serving. */
    base: RecipeSharePayload;
    portion: number;
    /** Actual logged composition (absolute) when edited. */
    edited?: RecipeSharePayload;
    ingredientCount: number;
    macros: Macros;
    diff: DiffRow[];
    diffSummary: { added: number; removed: number; changed: number };
    /** Snapshot: base/edited recipe already present in the library at load time. */
    originalImported: boolean;
    editedImported: boolean;
    originalSig: string;
    editedSig: string | null;
}

export interface FoodBatchSlide {
    type: "foods";
    id: string;
    foods: FoodBatchItem[];
}

export type Slide = RecipeSlide | FoodBatchSlide;

export interface ImportQueue {
    sharedBy?: string;
    slides: Slide[];
}

export type DecisionBucket = "template" | "item" | "skipped";

export interface Decision {
    key: string;
    title: string;
    bucket: DecisionBucket;
    /** i18n key + params for the summary row label. */
    summaryKey: string;
    summaryParams?: Record<string, string | number>;
    icon: string;
    tone: "success" | "primary" | "muted";
    /** Undefined for skips; the sole place a decision writes to the DB. */
    commit?: (cache: ImportCache) => void;
}

// ── Macros / formatting ────────────────────────────────────

const round = (n: number) => Math.round(n);

export function formatGrams(grams: number): string {
    return `${round(grams)} g`;
}

export function computeMacros(items: SharedRecipeItem[]): Macros {
    const m: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const it of items) {
        const f = it.food;
        const factor = (Number(it.quantity_grams) || 0) / 100;
        m.calories += (Number(f.calories_per_100g) || 0) * factor;
        m.protein += (Number(f.protein_per_100g) || 0) * factor;
        m.carbs += (Number(f.carbs_per_100g) || 0) * factor;
        m.fat += (Number(f.fat_per_100g) || 0) * factor;
    }
    return { calories: round(m.calories), protein: round(m.protein), carbs: round(m.carbs), fat: round(m.fat) };
}

function foodMacros(food: SharedFood, grams: number): Macros {
    return computeMacros([{ food, quantity_grams: grams, quantity_unit: "g" }]);
}

// ── Diff (base × portion vs. edited) ───────────────────────

function diffItems(baseScaled: SharedRecipeItem[], edited: SharedRecipeItem[]): DiffRow[] {
    const baseByName = new Map(baseScaled.map((i) => [i.food.name, i.quantity_grams]));
    const editedByName = new Map(edited.map((i) => [i.food.name, i.quantity_grams]));
    const rows: DiffRow[] = [];
    for (const e of edited) {
        const name = e.food.name;
        if (!baseByName.has(name)) {
            rows.push({ name, type: "added", qtyText: formatGrams(e.quantity_grams) });
        } else if (round(baseByName.get(name)!) !== round(e.quantity_grams)) {
            rows.push({
                name,
                type: "changed",
                qtyText: `${formatGrams(baseByName.get(name)!)} → ${formatGrams(e.quantity_grams)}`,
            });
        } else {
            rows.push({ name, type: "same", qtyText: formatGrams(e.quantity_grams) });
        }
    }
    for (const b of baseScaled) {
        if (!editedByName.has(b.food.name)) {
            rows.push({ name: b.food.name, type: "removed", qtyText: formatGrams(b.quantity_grams) });
        }
    }
    return rows;
}

// ── Queue building ─────────────────────────────────────────

function libraryRecipeSignatures(): Set<string> {
    const set = new Set<string>();
    for (const recipe of getAllRecipes()) {
        const payload = buildRecipePayload(recipe.id);
        if (payload) set.add(recipeSignature(payload));
    }
    return set;
}

function foodItem(id: string, food: SharedFood, fromLog: boolean, grams: number, unit: string, meal: string): FoodBatchItem {
    const serving = Number(food.serving_size);
    const g = Number(grams) > 0 ? Number(grams) : serving > 0 ? serving : 100;
    return {
        id,
        food,
        title: food.name,
        grams: g,
        unit: unit || "g",
        macros: foodMacros(food, g),
        fromLog,
        meal,
    };
}

function recipeSlide(
    id: string,
    base: RecipeSharePayload,
    portion: number,
    isEntry: boolean,
    originalMeal: string,
    edited: RecipeSharePayload | undefined,
    librarySigs: Set<string>,
): RecipeSlide {
    const isEdited = !!edited && edited.items.length > 0;
    const baseScaled = scaleRecipeItems(base.items, portion);
    const diff = isEdited ? diffItems(baseScaled, edited!.items) : [];
    const diffSummary = { added: 0, removed: 0, changed: 0 };
    for (const row of diff) {
        if (row.type === "added") diffSummary.added++;
        else if (row.type === "removed") diffSummary.removed++;
        else if (row.type === "changed") diffSummary.changed++;
    }
    const originalSig = recipeSignature(base);
    const editedSig = isEdited ? recipeSignature({ name: base.name, items: edited!.items }) : null;
    return {
        type: "recipe",
        id,
        title: base.name,
        isEntry,
        originalMeal,
        isEdited,
        base,
        portion,
        edited: isEdited ? edited : undefined,
        ingredientCount: base.items.length,
        macros: isEdited ? computeMacros(edited!.items) : computeMacros(base.items),
        diff,
        diffSummary,
        originalImported: librarySigs.has(originalSig),
        editedImported: editedSig ? librarySigs.has(editedSig) : false,
        originalSig,
        editedSig,
    };
}

/**
 * Normalizes any share into an ordered queue: one slide per shared recipe (or
 * recipe log), followed by a single batch slide holding every shared food.
 */
export function buildImportQueue(share: FetchedShare): ImportQueue {
    const librarySigs = libraryRecipeSignatures();
    const recipeSlides: RecipeSlide[] = [];
    const foods: FoodBatchItem[] = [];
    let sharedBy: string | undefined;

    if (share.kind === "food") {
        const p = share.payload as FoodSharePayload;
        sharedBy = p?.sharedBy;
        if (p?.food) foods.push(foodItem("food-0", p.food, false, p.food.serving_size ?? 100, "g", "snack"));
    } else if (share.kind === "recipe") {
        const p = share.payload as RecipeSharePayload;
        sharedBy = p?.sharedBy;
        if (p?.name && Array.isArray(p.items)) {
            recipeSlides.push(recipeSlide("recipe-0", p, 1, false, "snack", undefined, librarySigs));
        }
    } else {
        const p = share.payload as LogSharePayload;
        sharedBy = p?.sharedBy;
        const items = Array.isArray(p?.items) ? p.items : [];
        items.forEach((item, i) => {
            if (item?.type === "food" && item.food) {
                foods.push(foodItem(`food-${i}`, item.food, true, item.quantity_grams, item.quantity_unit, item.meal_type));
            } else if (item?.type === "recipe" && item.recipe) {
                recipeSlides.push(
                    recipeSlide(`recipe-${i}`, item.recipe, item.portion, true, item.meal_type, item.edited, librarySigs),
                );
            }
        });
    }

    const slides: Slide[] = [...recipeSlides];
    if (foods.length > 0) slides.push({ type: "foods", id: "foods", foods });
    return { sharedBy, slides };
}

// ── Decision factories (build display + a deferred commit thunk) ──

export function skipDecision(key: string, title: string): Decision {
    return { key, title, bucket: "skipped", summaryKey: "share.import.outcomeSkipped", icon: "arrow-forward-circle", tone: "muted" };
}

export function saveFoodDecision(item: FoodBatchItem): Decision {
    return {
        key: item.id,
        title: item.title,
        bucket: "template",
        summaryKey: "share.import.outcomeSavedFood",
        icon: "bookmark",
        tone: "primary",
        commit: (cache) => findOrCreateFood(item.food, cache),
    };
}

export function logFoodDecision(item: FoodBatchItem, dateKey: string, dateLabel: string, meal: string): Decision {
    return {
        key: item.id,
        title: item.title,
        bucket: "item",
        summaryKey: "share.import.outcomeLogged",
        summaryParams: { meal: mealKey(meal), date: dateLabel },
        icon: "checkmark-circle",
        tone: "success",
        commit: (cache) => logSharedFood(item.food, item.grams, item.unit, dateKey, meal, cache),
    };
}

export function saveTemplateDecision(slide: RecipeSlide, edited: boolean): Decision {
    const recipe = edited ? slide.edited! : slide.base;
    return {
        key: `${slide.id}-tpl`,
        title: slide.title,
        bucket: "template",
        summaryKey: edited ? "share.import.outcomeSavedEdited" : "share.import.outcomeSavedTemplate",
        icon: "bookmark",
        tone: "primary",
        commit: (cache) => importRecipePayload(recipe, cache),
    };
}

export function logRecipeDecision(
    slide: RecipeSlide,
    edited: boolean,
    dateKey: string,
    dateLabel: string,
    meal: string,
): Decision {
    return {
        key: `${slide.id}-log`,
        title: slide.title,
        bucket: "item",
        summaryKey: edited ? "share.import.outcomeLoggedEdited" : "share.import.outcomeLoggedRecipe",
        summaryParams: { meal: mealKey(meal), date: dateLabel },
        icon: "checkmark-circle",
        tone: "success",
        commit: (cache) =>
            edited
                ? logEditedRecipeInstance(slide.edited!, dateKey, meal, cache)
                : logSharedRecipe(slide.base, slide.portion, dateKey, meal, cache),
    };
}

/** Meal i18n suffix (matches existing `meal.<key>` keys); guards unknowns. */
function mealKey(meal: string): string {
    return ["breakfast", "lunch", "dinner", "snack"].includes(meal) ? meal : "snack";
}

// ── Commit (the only DB-writing path) ──────────────────────

/** Executes every accumulated decision in order, sharing one dedupe cache. */
export function commitImportPlan(decisions: Decision[]): void {
    const cache = createImportCache();
    for (const decision of decisions) decision.commit?.(cache);
}

/** Headline counts for the summary screen. */
export function summarizeDecisions(decisions: Decision[]): { templates: number; items: number; skipped: number } {
    let templates = 0;
    let items = 0;
    let skipped = 0;
    for (const d of decisions) {
        if (d.bucket === "template") templates++;
        else if (d.bucket === "item") items++;
        else skipped++;
    }
    return { templates, items, skipped };
}
