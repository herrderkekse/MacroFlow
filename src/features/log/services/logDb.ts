import { getRecipeById, getRecipeItems, type Food } from "@/src/features/templates/services/templateDb";
import { db } from "@/src/services/db";
import { entries, foods, recipeLogs, weightLogs } from "@/src/services/db/schema";
import { diffCalendarDays, formatDateKey as formatLocalDateKey, parseDateKey } from "@/src/utils/date";
import logger from "@/src/utils/logger";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export type Entry = typeof entries.$inferSelect;

export interface EntryWithFood {
    entries: Entry;
    foods: Food | null;
}

export interface RecipeGroup {
    recipeLogId: number;
    recipeId: number;
    recipeName: string;
    portion: number;
    rows: EntryWithFood[];
}
export type NewEntry = typeof entries.$inferInsert;
export type RecipeLog = typeof recipeLogs.$inferSelect;
export type NewRecipeLog = typeof recipeLogs.$inferInsert;
export type WeightLog = typeof weightLogs.$inferSelect;
export type NewWeightLog = typeof weightLogs.$inferInsert;

// ── Entry CRUD ─────────────────────────────────────────────

export function addEntry(entry: NewEntry): Entry {
    return db.insert(entries).values(entry).returning().get();
}

export function formatDateKey(date: Date): string {
    return formatLocalDateKey(date);
}

export function getEntriesByDate(date: Date) {
    const key = formatDateKey(date);

    return db
        .select()
        .from(entries)
        .leftJoin(foods, eq(entries.food_id, foods.id))
        .where(eq(entries.date, key))
        .orderBy(entries.timestamp)
        .all();
}

export function getEntriesByDateRange(startDate: Date, endDate: Date) {
    const startKey = formatDateKey(startDate);
    const endKey = formatDateKey(endDate);

    return db
        .select()
        .from(entries)
        .leftJoin(foods, eq(entries.food_id, foods.id))
        .where(and(gte(entries.date, startKey), lte(entries.date, endKey)))
        .orderBy(entries.date, entries.timestamp)
        .all();
}

export function deleteEntry(id: number) {
    db.delete(entries).where(eq(entries.id, id)).run();
}

export function confirmEntry(id: number) {
    db.update(entries).set({ is_scheduled: 0 }).where(eq(entries.id, id)).run();
}

export function confirmRecipeLog(recipeLogId: number) {
    db.update(entries).set({ is_scheduled: 0 }).where(eq(entries.recipe_log_id, recipeLogId)).run();
}

export function updateEntry(id: number, values: Partial<NewEntry>) {
    db.update(entries).set(values).where(eq(entries.id, id)).run();
}

export function getEntryById(id: number) {
    return db
        .select()
        .from(entries)
        .leftJoin(foods, eq(entries.food_id, foods.id))
        .where(eq(entries.id, id))
        .get();
}

// ── Streak ─────────────────────────────────────────────────

export function getStreak(): number {
    const MINIMAL_STREAK = 3;

    const rows = db
        .selectDistinct({ date: entries.date })
        .from(entries)
        .where(sql`${entries.date} <= ${formatDateKey(new Date())}`)
        .orderBy(sql`${entries.date} DESC`)
        .all();
    if (rows.length === 0) {
        logger.info("[DB] No entries found, streak is 0.");
        return 0;
    }

    const toDateStr = (d: Date) => formatDateKey(d);
    const todayStr = toDateStr(new Date());

    const last = rows[0].date;
    if (last !== todayStr) {
        return 0;
    }

    let streak = 1;
    for (let i = 1; i < rows.length; i++) {
        const curr = parseDateKey(rows[i - 1].date);
        const prev = parseDateKey(rows[i].date);
        if (diffCalendarDays(curr, prev) === 1) {
            streak++;
        } else {
            break;
        }
    }
    logger.info(`[DB] Calculated streak: ${streak} (from ${rows.length} days of data)`);
    return streak >= MINIMAL_STREAK ? streak : 0;
}

// ── Recipe Logging ─────────────────────────────────────────

export interface LoggedRecipeGroup {
    recipeLogId: number;
    recipeId: number;
    recipeName: string;
    portion: number;
    isScheduled: boolean;
}

export function getLoggedRecipeGroups(date: string, mealType: string): LoggedRecipeGroup[] {
    const rows = db
        .select({
            recipeLogId: recipeLogs.id,
            recipeId: recipeLogs.recipe_id,
            portion: recipeLogs.portion,
        })
        .from(recipeLogs)
        .where(
            and(
                eq(recipeLogs.date, date),
                eq(recipeLogs.meal_type, mealType),
            ),
        )
        .all();

    return rows.map((row) => {
        const recipe = getRecipeById(row.recipeId);
        const groupEntries = db
            .select({ is_scheduled: entries.is_scheduled })
            .from(entries)
            .where(eq(entries.recipe_log_id, row.recipeLogId))
            .all();
        const isScheduled = groupEntries.length > 0 && groupEntries.every((e) => e.is_scheduled === 1);
        return {
            recipeLogId: row.recipeLogId,
            recipeId: row.recipeId,
            recipeName: recipe?.name ?? "Recipe",
            portion: row.portion,
            isScheduled,
        };
    });
}

export function getRecipeLogById(id: number): RecipeLog | undefined {
    return db.select().from(recipeLogs).where(eq(recipeLogs.id, id)).get();
}

export function logRecipeToMeal(
    recipeId: number,
    mealType: string,
    date: string,
    portionMultiplier = 1,
    isScheduled = 0,
): number {
    const recipeLog = db
        .insert(recipeLogs)
        .values({
            recipe_id: recipeId,
            date,
            meal_type: mealType,
            portion: portionMultiplier,
            timestamp: Date.now(),
        })
        .returning()
        .get();

    const items = getRecipeItems(recipeId);
    const ts = Date.now();
    for (const row of items) {
        db.insert(entries)
            .values({
                food_id: row.recipe_items.food_id,
                quantity_grams: row.recipe_items.quantity_grams * portionMultiplier,
                quantity_unit: row.recipe_items.quantity_unit ?? "g",
                timestamp: ts,
                date,
                meal_type: mealType,
                recipe_log_id: recipeLog.id,
                is_scheduled: isScheduled,
            })
            .run();
    }
    return recipeLog.id;
}

export function updateRecipeLogPortion(
    recipeLogId: number,
    newMultiplier: number,
) {
    const recipeLog = getRecipeLogById(recipeLogId);
    if (!recipeLog) return;

    const oldMultiplier = recipeLog.portion;
    if (oldMultiplier === 0) return;
    const ratio = newMultiplier / oldMultiplier;

    db.update(recipeLogs)
        .set({ portion: newMultiplier })
        .where(eq(recipeLogs.id, recipeLogId))
        .run();

    const groupEntries = db
        .select()
        .from(entries)
        .where(eq(entries.recipe_log_id, recipeLogId))
        .all();
    for (const entry of groupEntries) {
        db.update(entries)
            .set({ quantity_grams: entry.quantity_grams * ratio })
            .where(eq(entries.id, entry.id))
            .run();
    }
}

export function deleteRecipeLog(recipeLogId: number) {
    db.delete(entries).where(eq(entries.recipe_log_id, recipeLogId)).run();
    db.delete(recipeLogs).where(eq(recipeLogs.id, recipeLogId)).run();
}

// ── Move / Copy entries ────────────────────────────────────

export function moveEntriesToDate(
    standaloneEntryIds: number[],
    recipeLogIds: number[],
    targetDate: string,
    targetMealType: string | null,
) {
    for (const rlId of recipeLogIds) {
        db.update(recipeLogs)
            .set({
                date: targetDate,
                ...(targetMealType ? { meal_type: targetMealType } : {}),
            })
            .where(eq(recipeLogs.id, rlId))
            .run();
        db.update(entries)
            .set({
                date: targetDate,
                ...(targetMealType ? { meal_type: targetMealType } : {}),
            })
            .where(eq(entries.recipe_log_id, rlId))
            .run();
    }
    for (const entryId of standaloneEntryIds) {
        db.update(entries)
            .set({
                date: targetDate,
                ...(targetMealType ? { meal_type: targetMealType } : {}),
                recipe_log_id: null,
            })
            .where(eq(entries.id, entryId))
            .run();
    }
}

export function copyEntriesToDate(
    standaloneEntryIds: number[],
    recipeLogIds: number[],
    targetDate: string,
    targetMealType: string | null,
) {
    const ts = Date.now();
    for (const rlId of recipeLogIds) {
        const rl = getRecipeLogById(rlId);
        if (!rl) continue;
        const newRl = db
            .insert(recipeLogs)
            .values({
                recipe_id: rl.recipe_id,
                date: targetDate,
                meal_type: targetMealType ?? rl.meal_type,
                portion: rl.portion,
                timestamp: ts,
            })
            .returning()
            .get();
        const rlEntries = db
            .select()
            .from(entries)
            .where(eq(entries.recipe_log_id, rlId))
            .all();
        for (const entry of rlEntries) {
            db.insert(entries)
                .values({
                    food_id: entry.food_id,
                    quantity_grams: entry.quantity_grams,
                    quantity_unit: entry.quantity_unit,
                    timestamp: ts,
                    date: targetDate,
                    meal_type: targetMealType ?? entry.meal_type,
                    recipe_log_id: newRl.id,
                    is_scheduled: entry.is_scheduled,
                })
                .run();
        }
    }
    for (const entryId of standaloneEntryIds) {
        const entry = db.select().from(entries).where(eq(entries.id, entryId)).get();
        if (!entry) continue;
        db.insert(entries)
            .values({
                food_id: entry.food_id,
                quantity_grams: entry.quantity_grams,
                quantity_unit: entry.quantity_unit,
                timestamp: ts,
                date: targetDate,
                meal_type: targetMealType ?? entry.meal_type,
                is_scheduled: entry.is_scheduled,
            })
            .run();
    }
}

export function moveEntriesToRecipeLog(
    entryIds: number[],
    targetRecipeLogId: number,
    targetDate: string,
    targetMealType: string,
) {
    const sourceRecipeLogIds = new Set<number>();
    for (const entryId of entryIds) {
        const entry = db.select().from(entries).where(eq(entries.id, entryId)).get();
        if (entry?.recipe_log_id && entry.recipe_log_id !== targetRecipeLogId) {
            sourceRecipeLogIds.add(entry.recipe_log_id);
        }
        db.update(entries)
            .set({ recipe_log_id: targetRecipeLogId, date: targetDate, meal_type: targetMealType })
            .where(eq(entries.id, entryId))
            .run();
    }
    // Clean up source recipe logs that are now empty
    for (const rlId of sourceRecipeLogIds) {
        const remaining = db.select().from(entries).where(eq(entries.recipe_log_id, rlId)).all();
        if (remaining.length === 0) {
            db.delete(recipeLogs).where(eq(recipeLogs.id, rlId)).run();
        }
    }
}

export function copyEntriesToRecipeLog(
    entryIds: number[],
    targetRecipeLogId: number,
    targetDate: string,
    targetMealType: string,
) {
    const ts = Date.now();
    for (const entryId of entryIds) {
        const entry = db.select().from(entries).where(eq(entries.id, entryId)).get();
        if (!entry) continue;
        db.insert(entries)
            .values({
                food_id: entry.food_id,
                quantity_grams: entry.quantity_grams,
                quantity_unit: entry.quantity_unit,
                timestamp: ts,
                date: targetDate,
                meal_type: targetMealType,
                recipe_log_id: targetRecipeLogId,
                is_scheduled: entry.is_scheduled,
            })
            .run();
    }
}

// ── Weight Logging ─────────────────────────────────────────

export function addWeightLog(weightKg: number, date: Date): WeightLog {
    const dateKey = formatDateKey(date);
    return db
        .insert(weightLogs)
        .values({ weight_kg: weightKg, date: dateKey, timestamp: Date.now() })
        .returning()
        .get();
}

export function getWeightLogsForDate(date: Date): WeightLog[] {
    const dateKey = formatDateKey(date);
    return db
        .select()
        .from(weightLogs)
        .where(eq(weightLogs.date, dateKey))
        .orderBy(weightLogs.timestamp)
        .all();
}

export function deleteWeightLog(id: number) {
    db.delete(weightLogs).where(eq(weightLogs.id, id)).run();
}

export function getLatestWeightBefore(date: Date): WeightLog | undefined {
    const dateKey = formatDateKey(date);
    return db
        .select()
        .from(weightLogs)
        .where(lte(weightLogs.date, dateKey))
        .orderBy(sql`${weightLogs.date} DESC`)
        .get();
}

export function getWeightLogsForRange(startDate: string, endDate: string): WeightLog[] {
    return db
        .select()
        .from(weightLogs)
        .where(and(gte(weightLogs.date, startDate), lte(weightLogs.date, endDate)))
        .orderBy(weightLogs.date)
        .all();
}
