import { addEntry, deleteEntry, getEntriesByDate, getEntriesByDateRange, getEntryById, updateEntry } from "@/src/features/log/services/logDb";
import { getFoodById } from "@/src/features/templates/services/templateDb";
import i18n from "@/src/i18n";
import { parseDateKey, shiftCalendarDate } from "@/src/utils/date";
import { VALID_MEAL_TYPES } from "../../constants/toolDefinitions/entryToolDefinitions";
import { displayQuantity, resolveQuantityToGrams } from "../unitResolution";
import type { AiToolResult } from "../../types/toolDefinitionTypes";

type ToolExecutor = (args: Record<string, unknown>) => AiToolResult;

// ── Validators ────────────────────────────────────────────

export function isValidDateKey(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(parseDateKey(date).getTime());
}

export function isValidMealType(meal: unknown): meal is typeof VALID_MEAL_TYPES[number] {
    return typeof meal === "string" && VALID_MEAL_TYPES.includes(meal as any);
}

// ── Executors ─────────────────────────────────────────────

function executeReadLogEntries(args: Record<string, unknown>): AiToolResult {
    const date = String(args.date ?? "");
    if (!isValidDateKey(date)) return { success: false, summary: "Invalid date format. Use YYYY-MM-DD." };

    const rows = getEntriesByDate(parseDateKey(date));
    const result = rows.map((row) => {
        const display = displayQuantity(row.entries.quantity_grams, row.entries.quantity_unit, row.entries.food_id);
        return {
            entry_id: row.entries.id, food_id: row.entries.food_id,
            food_name: row.foods?.name ?? "Unknown", quantity: display.quantity, unit: display.unit,
            meal_type: row.entries.meal_type, is_scheduled: row.entries.is_scheduled,
            calories: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.calories_per_100g).toFixed(1) : 0,
            protein: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.protein_per_100g).toFixed(1) : 0,
            carbs: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.carbs_per_100g).toFixed(1) : 0,
            fat: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.fat_per_100g).toFixed(1) : 0,
        };
    });

    return { success: true, summary: i18n.t("chat.toolResult.readLogEntries", { count: result.length, date }), data: result };
}

function executeReadRecentLogEntries(args: Record<string, unknown>): AiToolResult {
    const days = Math.max(1, Math.min(30, Math.round(Number(args.days) || 1)));
    const today = new Date();
    const startDate = shiftCalendarDate(today, -(days - 1));
    const rows = getEntriesByDateRange(startDate, today);
    const grouped: Record<string, unknown[]> = {};

    for (const row of rows) {
        const date = row.entries.date;
        if (!grouped[date]) grouped[date] = [];
        const display = displayQuantity(row.entries.quantity_grams, row.entries.quantity_unit, row.entries.food_id);
        grouped[date].push({
            entry_id: row.entries.id, food_id: row.entries.food_id,
            food_name: row.foods?.name ?? "Unknown", quantity: display.quantity, unit: display.unit,
            meal_type: row.entries.meal_type,
            calories: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.calories_per_100g).toFixed(1) : 0,
            protein: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.protein_per_100g).toFixed(1) : 0,
            carbs: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.carbs_per_100g).toFixed(1) : 0,
            fat: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.fat_per_100g).toFixed(1) : 0,
        });
    }

    return { success: true, summary: i18n.t("chat.toolResult.readRecentLogEntries", { count: rows.length, dayCount: Object.keys(grouped).length }), data: grouped };
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

    return { success: true, summary: i18n.t("chat.toolResult.readRecentMacros", { count: Object.keys(result).length }), data: result };
}

function executeLogFood(args: Record<string, unknown>): AiToolResult {
    const foodId = Number(args.food_id);
    const quantity = Number(args.quantity);
    const date = String(args.date ?? "");
    const mealType = String(args.meal_type ?? "");

    if (!foodId || isNaN(foodId)) return { success: false, summary: "Invalid food_id." };
    if (!quantity || quantity <= 0) return { success: false, summary: "quantity must be a positive number." };
    if (!isValidDateKey(date)) return { success: false, summary: "Invalid date format. Use YYYY-MM-DD." };
    if (!isValidMealType(mealType)) return { success: false, summary: `Invalid meal_type. Must be one of: ${VALID_MEAL_TYPES.join(", ")}.` };

    const food = getFoodById(foodId);
    if (!food) return { success: false, summary: `Food with id ${foodId} not found. Use search_library to find valid food IDs.` };

    const unit = args.unit != null ? String(args.unit).trim() : food.default_unit;
    const resolved = resolveQuantityToGrams(quantity, unit, foodId);
    if ("error" in resolved) return { success: false, summary: resolved.error };

    const entry = addEntry({
        food_id: foodId, quantity_grams: resolved.grams, quantity_unit: unit,
        timestamp: Date.now(), date, meal_type: mealType,
    });

    return {
        success: true,
        summary: i18n.t("chat.toolResult.logFood", { quantity, unit, food: food.name, meal: mealType, date }),
        data: { entry_id: entry.id, food_name: food.name, quantity, unit, date, meal_type: mealType },
    };
}

function executeMoveLogEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);
    const targetDate = args.target_date != null ? String(args.target_date) : undefined;
    const targetMealType = args.target_meal_type != null ? String(args.target_meal_type) : undefined;

    if (!entryId || isNaN(entryId)) return { success: false, summary: "Invalid entry_id." };
    if (!targetDate && !targetMealType) return { success: false, summary: "Provide at least target_date or target_meal_type." };
    if (targetDate && !isValidDateKey(targetDate)) return { success: false, summary: "Invalid target_date format. Use YYYY-MM-DD." };
    if (targetMealType && !isValidMealType(targetMealType)) return { success: false, summary: `Invalid target_meal_type. Must be one of: ${VALID_MEAL_TYPES.join(", ")}.` };

    const row = getEntryById(entryId);
    if (!row) return { success: false, summary: `Entry with id ${entryId} not found. Use read_log_entries to find valid entry IDs.` };

    const updates: Record<string, unknown> = {};
    if (targetDate) updates.date = targetDate;
    if (targetMealType) updates.meal_type = targetMealType;
    updateEntry(entryId, updates);

    const newDate = targetDate ?? row.entries.date;
    const newMeal = targetMealType ?? row.entries.meal_type;
    return {
        success: true,
        summary: i18n.t("chat.toolResult.moveLogEntry", { food: row.foods?.name ?? "Unknown", meal: newMeal, date: newDate }),
        data: { entry_id: entryId, food_name: row.foods?.name, date: newDate, meal_type: newMeal },
    };
}

function executeUpdateLogEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);
    const quantity = Number(args.quantity);
    if (!entryId || isNaN(entryId)) return { success: false, summary: "Invalid entry_id." };
    if (!quantity || quantity <= 0) return { success: false, summary: "quantity must be a positive number." };

    const row = getEntryById(entryId);
    if (!row) return { success: false, summary: `Entry with id ${entryId} not found. Use read_log_entries to find valid entry IDs.` };

    const unit = args.unit != null ? String(args.unit).trim() : row.entries.quantity_unit;
    const foodId = row.entries.food_id;
    if (!foodId) return { success: false, summary: "Entry has no associated food." };

    const resolved = resolveQuantityToGrams(quantity, unit, foodId);
    if ("error" in resolved) return { success: false, summary: resolved.error };

    updateEntry(entryId, { quantity_grams: resolved.grams, quantity_unit: unit });
    return {
        success: true,
        summary: i18n.t("chat.toolResult.updateLogEntry", { food: row.foods?.name ?? "Unknown", quantity, unit }),
        data: { entry_id: entryId, food_name: row.foods?.name, quantity, unit },
    };
}

function executeDeleteLogEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);
    if (!entryId || isNaN(entryId)) return { success: false, summary: "Invalid entry_id." };

    const row = getEntryById(entryId);
    if (!row) return { success: false, summary: `Entry with id ${entryId} not found. Use read_log_entries to find valid entry IDs.` };

    deleteEntry(entryId);
    return {
        success: true,
        summary: i18n.t("chat.toolResult.deleteLogEntry", { food: row.foods?.name ?? "Unknown", meal: row.entries.meal_type, date: row.entries.date }),
        data: { entry_id: entryId, food_name: row.foods?.name },
    };
}

export const entryToolExecutors: Record<string, ToolExecutor> = {
    read_log_entries: executeReadLogEntries,
    read_recent_log_entries: executeReadRecentLogEntries,
    read_recent_macros: executeReadRecentMacros,
    log_food: executeLogFood,
    move_log_entry: executeMoveLogEntry,
    update_log_entry: executeUpdateLogEntry,
    delete_log_entry: executeDeleteLogEntry,
};
