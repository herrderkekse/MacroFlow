import { db } from "@/src/services/db";
import { entries, foods } from "@/src/services/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export interface DailyTotals {
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export function getDailyTotalsForRange(startDate: string, endDate: string): DailyTotals[] {
    const rows = db
        .select({
            date: entries.date,
            calories: sql<number>`coalesce(sum(${entries.quantity_grams} / 100.0 * ${foods.calories_per_100g}), 0)`,
            protein: sql<number>`coalesce(sum(${entries.quantity_grams} / 100.0 * ${foods.protein_per_100g}), 0)`,
            carbs: sql<number>`coalesce(sum(${entries.quantity_grams} / 100.0 * ${foods.carbs_per_100g}), 0)`,
            fat: sql<number>`coalesce(sum(${entries.quantity_grams} / 100.0 * ${foods.fat_per_100g}), 0)`,
        })
        .from(entries)
        .leftJoin(foods, eq(entries.food_id, foods.id))
        .where(and(gte(entries.date, startDate), lte(entries.date, endDate)))
        .groupBy(entries.date)
        .orderBy(entries.date)
        .all();

    return rows.map((r) => ({
        date: r.date,
        calories: Number(r.calories),
        protein: Number(r.protein),
        carbs: Number(r.carbs),
        fat: Number(r.fat),
    }));
}
