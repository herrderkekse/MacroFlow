import { addEntry, deleteEntry, getEntriesByDate, getEntriesByDateRange, getEntryById, updateEntry } from "@/src/features/log/services/logDb";
import { getGoals } from "@/src/features/settings/services/settingsDb";
import { getAllFoods, getAllRecipes, getFoodById, getRecipeItems, searchFoodsByName, searchRecipesByName } from "@/src/features/templates/services/templateDb";
import { parseDateKey, shiftCalendarDate } from "@/src/utils/date";
import logger from "@/src/utils/logger";
import type { AiFoodPayload, AiGoalsPayload, AiMealPlanEntry, AiRecipePayload } from "../types";
import { buildMealPlanPrompt } from "./aiConfig";
import { type AiToolCall, type AiToolResult, VALID_MEAL_TYPES } from "./toolDefinitions";

// ── Validators ────────────────────────────────────────────

function isValidDateKey(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(parseDateKey(date).getTime());
}

function isValidMealType(meal: unknown): meal is typeof VALID_MEAL_TYPES[number] {
    return typeof meal === "string" && VALID_MEAL_TYPES.includes(meal as any);
}

// ── Executors ─────────────────────────────────────────────

type ToolExecutor = (args: Record<string, unknown>) => AiToolResult;

function executeCreateMealPlan(args: Record<string, unknown>): AiToolResult {
    const days = Math.max(1, Math.min(7, Number(args.days) || 3));
    const likedFoods = String(args.liked_foods ?? "");
    const dislikedFoods = String(args.disliked_foods ?? "");

    const goals = getGoals();
    if (!goals) return { success: false, summary: "No daily macro goals set. Please configure goals first." };

    const allFoods = getAllFoods();
    if (allFoods.length === 0) return { success: false, summary: "No foods in library. Please add foods first." };

    const foodPayload: AiFoodPayload[] = allFoods.map((f) => ({
        id: f.id, name: f.name, calories_per_100g: f.calories_per_100g,
        protein_per_100g: f.protein_per_100g, carbs_per_100g: f.carbs_per_100g,
        fat_per_100g: f.fat_per_100g, default_unit: f.default_unit, serving_size: f.serving_size,
    }));

    const allRecipes = getAllRecipes();
    const recipePayload: AiRecipePayload[] = allRecipes.map((r) => {
        const items = getRecipeItems(r.id);
        return { id: r.id, name: r.name, items: items.map((i) => ({ food_id: i.recipe_items.food_id, quantity_grams: i.recipe_items.quantity_grams })) };
    });

    const goalsPayload: AiGoalsPayload = { calories: goals.calories, protein: goals.protein, carbs: goals.carbs, fat: goals.fat };
    const messages = buildMealPlanPrompt(foodPayload, recipePayload, goalsPayload, { likedFoods, dislikedFoods, days });

    return {
        success: true,
        summary: `Prepared meal plan request for ${days} day(s).`,
        data: {
            type: "meal_plan_request", messages, validFoodIds: allFoods.map((f) => f.id),
            goals: goalsPayload, foods: foodPayload, recipes: recipePayload,
            prefs: { likedFoods, dislikedFoods, days },
        },
    };
}

function executeReadEntries(args: Record<string, unknown>): AiToolResult {
    const date = String(args.date ?? "");
    if (!isValidDateKey(date)) return { success: false, summary: "Invalid date format. Use YYYY-MM-DD." };

    const rows = getEntriesByDate(parseDateKey(date));
    const result = rows.map((row) => ({
        entry_id: row.entries.id, food_id: row.entries.food_id,
        food_name: row.foods?.name ?? "Unknown", quantity_grams: row.entries.quantity_grams,
        quantity_unit: row.entries.quantity_unit, meal_type: row.entries.meal_type,
        is_scheduled: row.entries.is_scheduled,
        calories: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.calories_per_100g).toFixed(1) : 0,
        protein: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.protein_per_100g).toFixed(1) : 0,
        carbs: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.carbs_per_100g).toFixed(1) : 0,
        fat: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.fat_per_100g).toFixed(1) : 0,
    }));

    return { success: true, summary: `Found ${result.length} entries for ${date}.`, data: result };
}

function executeCreateEntry(args: Record<string, unknown>): AiToolResult {
    const foodId = Number(args.food_id);
    const quantityGrams = Number(args.quantity_grams);
    const date = String(args.date ?? "");
    const mealType = String(args.meal_type ?? "");

    if (!foodId || isNaN(foodId)) return { success: false, summary: "Invalid food_id." };
    if (!quantityGrams || quantityGrams <= 0) return { success: false, summary: "quantity_grams must be a positive number." };
    if (!isValidDateKey(date)) return { success: false, summary: "Invalid date format. Use YYYY-MM-DD." };
    if (!isValidMealType(mealType)) return { success: false, summary: `Invalid meal_type. Must be one of: ${VALID_MEAL_TYPES.join(", ")}.` };

    const food = getFoodById(foodId);
    if (!food) return { success: false, summary: `Food with id ${foodId} not found. Use search_templates to find valid food IDs.` };

    const entry = addEntry({
        food_id: foodId, quantity_grams: quantityGrams, quantity_unit: "g",
        timestamp: Date.now(), date, meal_type: mealType,
    });

    return {
        success: true,
        summary: `Added ${quantityGrams}g of "${food.name}" to ${mealType} on ${date}.`,
        data: { entry_id: entry.id, food_name: food.name, quantity_grams: quantityGrams, date, meal_type: mealType },
    };
}

function executeMoveEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);
    const targetDate = args.target_date != null ? String(args.target_date) : undefined;
    const targetMealType = args.target_meal_type != null ? String(args.target_meal_type) : undefined;

    if (!entryId || isNaN(entryId)) return { success: false, summary: "Invalid entry_id." };
    if (!targetDate && !targetMealType) return { success: false, summary: "Provide at least target_date or target_meal_type." };
    if (targetDate && !isValidDateKey(targetDate)) return { success: false, summary: "Invalid target_date format. Use YYYY-MM-DD." };
    if (targetMealType && !isValidMealType(targetMealType)) return { success: false, summary: `Invalid target_meal_type. Must be one of: ${VALID_MEAL_TYPES.join(", ")}.` };

    const row = getEntryById(entryId);
    if (!row) return { success: false, summary: `Entry with id ${entryId} not found. Use read_entries to find valid entry IDs.` };

    const updates: Record<string, unknown> = {};
    if (targetDate) updates.date = targetDate;
    if (targetMealType) updates.meal_type = targetMealType;
    updateEntry(entryId, updates);

    const newDate = targetDate ?? row.entries.date;
    const newMeal = targetMealType ?? row.entries.meal_type;
    return {
        success: true,
        summary: `Moved entry ${entryId} ("${row.foods?.name ?? "Unknown"}") to ${newMeal} on ${newDate}.`,
        data: { entry_id: entryId, food_name: row.foods?.name, date: newDate, meal_type: newMeal },
    };
}

function executeUpdateEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);
    const quantityGrams = Number(args.quantity_grams);
    if (!entryId || isNaN(entryId)) return { success: false, summary: "Invalid entry_id." };
    if (!quantityGrams || quantityGrams <= 0) return { success: false, summary: "quantity_grams must be a positive number." };

    const row = getEntryById(entryId);
    if (!row) return { success: false, summary: `Entry with id ${entryId} not found. Use read_entries to find valid entry IDs.` };

    updateEntry(entryId, { quantity_grams: quantityGrams });
    return {
        success: true,
        summary: `Updated entry ${entryId} ("${row.foods?.name ?? "Unknown"}") to ${quantityGrams}g.`,
        data: { entry_id: entryId, food_name: row.foods?.name, quantity_grams: quantityGrams },
    };
}

function executeRemoveEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);
    if (!entryId || isNaN(entryId)) return { success: false, summary: "Invalid entry_id." };

    const row = getEntryById(entryId);
    if (!row) return { success: false, summary: `Entry with id ${entryId} not found. Use read_entries to find valid entry IDs.` };

    deleteEntry(entryId);
    return {
        success: true,
        summary: `Removed entry ${entryId} ("${row.foods?.name ?? "Unknown"}", ${row.entries.quantity_grams}g from ${row.entries.meal_type} on ${row.entries.date}).`,
        data: { entry_id: entryId, food_name: row.foods?.name },
    };
}

function executeSearchTemplates(args: Record<string, unknown>): AiToolResult {
    const query = String(args.query ?? "").trim();
    if (!query) return { success: false, summary: "Search query cannot be empty." };

    const matchedFoods = searchFoodsByName(query).map((f) => ({
        type: "food" as const, id: f.id, name: f.name,
        calories_per_100g: f.calories_per_100g, protein_per_100g: f.protein_per_100g,
        carbs_per_100g: f.carbs_per_100g, fat_per_100g: f.fat_per_100g,
        default_unit: f.default_unit, serving_size: f.serving_size,
    }));
    const matchedRecipes = searchRecipesByName(query).map((r) => ({ type: "recipe" as const, id: r.id, name: r.name }));
    const results = [...matchedFoods, ...matchedRecipes];

    return { success: true, summary: `Found ${matchedFoods.length} food(s) and ${matchedRecipes.length} recipe(s) matching "${query}".`, data: results };
}

function executeReadRecentEntries(args: Record<string, unknown>): AiToolResult {
    const days = Math.max(1, Math.min(30, Math.round(Number(args.days) || 1)));
    const today = new Date();
    const startDate = shiftCalendarDate(today, -(days - 1));
    const rows = getEntriesByDateRange(startDate, today);
    const grouped: Record<string, unknown[]> = {};

    for (const row of rows) {
        const date = row.entries.date;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push({
            entry_id: row.entries.id, food_id: row.entries.food_id,
            food_name: row.foods?.name ?? "Unknown", quantity_grams: row.entries.quantity_grams,
            meal_type: row.entries.meal_type,
            calories: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.calories_per_100g).toFixed(1) : 0,
            protein: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.protein_per_100g).toFixed(1) : 0,
            carbs: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.carbs_per_100g).toFixed(1) : 0,
            fat: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.fat_per_100g).toFixed(1) : 0,
        });
    }

    return { success: true, summary: `Found ${rows.length} entries across ${Object.keys(grouped).length} day(s).`, data: grouped };
}

function executeReadRecentMacros(args: Record<string, unknown>): AiToolResult {
    const days = Math.max(1, Math.min(30, Math.round(Number(args.days) || 1)));
    const today = new Date();
    const startDate = shiftCalendarDate(today, -(days - 1));
    const rows = getEntriesByDateRange(startDate, today);
    const dailyTotals: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};

    for (const row of rows) {
        const date = row.entries.date;
        if (!dailyTotals[date]) dailyTotals[date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        if (row.foods) {
            const q = row.entries.quantity_grams / 100;
            dailyTotals[date].calories += q * row.foods.calories_per_100g;
            dailyTotals[date].protein += q * row.foods.protein_per_100g;
            dailyTotals[date].carbs += q * row.foods.carbs_per_100g;
            dailyTotals[date].fat += q * row.foods.fat_per_100g;
        }
    }

    const result = Object.fromEntries(
        Object.entries(dailyTotals).map(([date, totals]) => [
            date, { calories: +totals.calories.toFixed(1), protein: +totals.protein.toFixed(1), carbs: +totals.carbs.toFixed(1), fat: +totals.fat.toFixed(1) },
        ]),
    );

    return { success: true, summary: `Macro totals for ${Object.keys(result).length} day(s).`, data: result };
}

// ── Registry + public API ─────────────────────────────────

const toolExecutors: Record<string, ToolExecutor> = {
    create_meal_plan: executeCreateMealPlan,
    read_entries: executeReadEntries,
    create_entry: executeCreateEntry,
    move_entry: executeMoveEntry,
    update_entry: executeUpdateEntry,
    remove_entry: executeRemoveEntry,
    search_templates: executeSearchTemplates,
    read_recent_entries: executeReadRecentEntries,
    read_recent_macros: executeReadRecentMacros,
};

export function executeTool(call: AiToolCall): AiToolResult {
    const executor = toolExecutors[call.name];
    if (!executor) {
        logger.warn("[AI/Tools] Unknown tool requested", { name: call.name });
        return { success: false, summary: `Unknown tool: ${call.name}` };
    }
    logger.info("[AI/Tools] Executing tool", { name: call.name, args: call.arguments });
    return executor(call.arguments);
}

export function importMealPlanEntries(entries: AiMealPlanEntry[]): number {
    const ts = Date.now();
    let count = 0;
    for (const entry of entries) {
        addEntry({
            food_id: entry.food_id, quantity_grams: entry.quantity_grams, quantity_unit: "g",
            timestamp: ts, date: entry.date, meal_type: entry.meal_type, is_scheduled: 1,
        });
        count++;
    }
    logger.info("[AI/Tools] Imported meal plan entries", { count });
    return count;
}
