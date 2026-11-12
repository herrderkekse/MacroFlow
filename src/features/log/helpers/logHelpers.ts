import { type MealType } from "@/src/shared/types";
import { parseDateKey } from "@/src/utils/date";
import { getEntriesByDate, type EntryWithFood, type WeightLog } from "../services/logDb";

export type { EntryWithFood };

export function computeWeightTrend(logs: WeightLog[]): "up" | "down" | "flat" | null {
    if (logs.length < 2) return null;
    const n = logs.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const baseDate = parseDateKey(logs[0].date).getTime();
    for (let i = 0; i < n; i++) {
        const x = (parseDateKey(logs[i].date).getTime() - baseDate) / (1000 * 60 * 60 * 24);
        const y = logs[i].weight_kg;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    }
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return "flat";
    const slope = (n * sumXY - sumX * sumY) / denom;
    if (Math.abs(slope) < 0.01) return "flat";
    return slope > 0 ? "up" : "down";
}

export function loadGrouped(date: Date): Record<MealType, EntryWithFood[]> {
    const rows = getEntriesByDate(date);
    const map: Record<MealType, EntryWithFood[]> = {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
    };
    for (const row of rows) {
        const mt = row.entries.meal_type as MealType;
        if (map[mt]) map[mt].push(row);
    }
    return map;
}

export function computeTotals(grouped: Record<MealType, EntryWithFood[]>) {
    const all = Object.values(grouped).flat();
    const actual = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const scheduled = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const row of all) {
        const qty = row.entries.quantity_grams;
        const food = row.foods;
        if (!food) continue;
        const target = row.entries.is_scheduled === 1 ? scheduled : actual;
        target.calories += (food.calories_per_100g * qty) / 100;
        target.protein += (food.protein_per_100g * qty) / 100;
        target.carbs += (food.carbs_per_100g * qty) / 100;
        target.fat += (food.fat_per_100g * qty) / 100;
    }
    return {
        calories: actual.calories + scheduled.calories,
        protein: actual.protein + scheduled.protein,
        carbs: actual.carbs + scheduled.carbs,
        fat: actual.fat + scheduled.fat,
        actual,
        scheduled,
    };
}

export interface MacroTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

const ZERO_TOTALS: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/** Splits a day's totals into what was eaten and what is only planned. */
export function splitEatenPlanned(totals: MacroTotals, scheduled?: MacroTotals) {
    const planned = scheduled ?? ZERO_TOTALS;
    const eaten: MacroTotals = {
        calories: totals.calories - planned.calories,
        protein: totals.protein - planned.protein,
        carbs: totals.carbs - planned.carbs,
        fat: totals.fat - planned.fat,
    };
    return { eaten, planned, hasPlanned: planned.calories > 0 };
}
