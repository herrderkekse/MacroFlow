import { and, eq, gte, like, lte, sql } from "drizzle-orm";
import logger from "../utils/logger";
import { diffCalendarDays, formatDateKey as formatLocalDateKey, parseDateKey } from "../utils/date";
import { db } from "./index";
import { entries, foods, goals, notificationSettings, recipeItems, recipeLogs, recipes, servingUnits, weightLogs } from "./schema";

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Goals = typeof goals.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type NewRecipeItem = typeof recipeItems.$inferInsert;
export type RecipeLog = typeof recipeLogs.$inferSelect;
export type NewRecipeLog = typeof recipeLogs.$inferInsert;
export type WeightLog = typeof weightLogs.$inferSelect;
export type NewWeightLog = typeof weightLogs.$inferInsert;
export type ServingUnit = typeof servingUnits.$inferSelect;
export type NewServingUnit = typeof servingUnits.$inferInsert;
export type NotificationSettings = typeof notificationSettings.$inferSelect;

// ── Food CRUD ──────────────────────────────────────────────

export function addFood(food: NewFood): Food {
    return db.insert(foods).values(food).returning().get();
}

export function searchFoodsByName(query: string): Food[] {
    return db
        .select()
        .from(foods)
        .where(and(like(foods.name, `%${query}%`), eq(foods.deleted, 0)))
        .limit(30)
        .all();
}

export function getFoodByBarcode(barcode: string): Food | undefined {
    return db.select().from(foods).where(eq(foods.barcode, barcode)).get();
}

export function getFoodByOpenfoodfactsId(offId: string): Food | undefined {
    return db
        .select()
        .from(foods)
        .where(eq(foods.openfoodfacts_id, offId))
        .get();
}

export function getAllFoods(): Food[] {
    return db.select().from(foods).where(eq(foods.deleted, 0)).all();
}

export function getFoodById(id: number): Food | undefined {
    return db.select().from(foods).where(eq(foods.id, id)).get();
}

export function updateFood(id: number, values: Partial<NewFood>) {
    db.update(foods).set(values).where(eq(foods.id, id)).run();
}

export function deleteFood(id: number) {
    db.delete(servingUnits).where(eq(servingUnits.food_id, id)).run();
    db.delete(recipeItems).where(eq(recipeItems.food_id, id)).run();
    db.delete(entries).where(eq(entries.food_id, id)).run();
    db.delete(foods).where(eq(foods.id, id)).run();
}

export function softDeleteFood(id: number) {
    db.update(foods).set({ deleted: 1 }).where(eq(foods.id, id)).run();
}

export function duplicateFood(id: number, overrides: Partial<NewFood>): Food {
    const original = getFoodById(id);
    if (!original) throw new Error(`Food ${id} not found`);
    const { id: _id, deleted: _del, ...rest } = original;
    const created = db.insert(foods).values({ ...rest, ...overrides, deleted: 0 }).returning().get();
    // Copy serving units to the new food
    const units = getServingUnits(id);
    for (const u of units) {
        db.insert(servingUnits).values({ food_id: created.id, name: u.name, grams: u.grams }).run();
    }
    return created;
}

// ── Serving Units ─────────────────────────────────────────

export function getServingUnits(foodId: number): ServingUnit[] {
    return db.select().from(servingUnits).where(eq(servingUnits.food_id, foodId)).all();
}

export function addServingUnit(unit: NewServingUnit): ServingUnit {
    return db.insert(servingUnits).values(unit).returning().get();
}

function renameServingUnitReferences(foodId: number, oldName: string, newName: string) {
    db.update(entries)
        .set({ quantity_unit: newName })
        .where(and(eq(entries.food_id, foodId), eq(entries.quantity_unit, oldName)))
        .run();

    db.update(recipeItems)
        .set({ quantity_unit: newName })
        .where(and(eq(recipeItems.food_id, foodId), eq(recipeItems.quantity_unit, oldName)))
        .run();

    db.update(foods)
        .set({ last_logged_unit: newName })
        .where(and(eq(foods.id, foodId), eq(foods.last_logged_unit, oldName)))
        .run();
}

function normalizeDeletedServingUnitReferences(foodId: number, unitName: string, grams: number) {
    db.update(entries)
        .set({ quantity_unit: "g" })
        .where(and(eq(entries.food_id, foodId), eq(entries.quantity_unit, unitName)))
        .run();

    db.update(recipeItems)
        .set({ quantity_unit: "g" })
        .where(and(eq(recipeItems.food_id, foodId), eq(recipeItems.quantity_unit, unitName)))
        .run();

    db.update(foods)
        .set({
            last_logged_amount: sql`coalesce(${foods.last_logged_amount}, 0) * ${grams}`,
            last_logged_unit: "g",
        })
        .where(and(eq(foods.id, foodId), eq(foods.last_logged_unit, unitName)))
        .run();
}

export function updateServingUnit(id: number, values: Partial<NewServingUnit>) {
    const existing = db.select().from(servingUnits).where(eq(servingUnits.id, id)).get();
    if (!existing) return;
    db.update(servingUnits).set(values).where(eq(servingUnits.id, id)).run();
    if (values.name && values.name !== existing.name) {
        renameServingUnitReferences(existing.food_id, existing.name, values.name);
    }
}

export function deleteServingUnit(id: number) {
    const existing = db.select().from(servingUnits).where(eq(servingUnits.id, id)).get();
    if (!existing) return;
    normalizeDeletedServingUnitReferences(existing.food_id, existing.name, existing.grams);
    db.delete(servingUnits).where(eq(servingUnits.id, id)).run();
}

export function deleteServingUnitsForFood(foodId: number) {
    const units = getServingUnits(foodId);
    for (const unit of units) {
        normalizeDeletedServingUnitReferences(foodId, unit.name, unit.grams);
    }
    db.delete(servingUnits).where(eq(servingUnits.food_id, foodId)).run();
}

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

// ── Goals ──────────────────────────────────────────────────

export function getGoals(): Goals | undefined {
    return db.select().from(goals).where(eq(goals.id, 1)).get();
}

export function setGoals(values: Partial<Omit<Goals, "id">>) {
    db.update(goals).set(values).where(eq(goals.id, 1)).run();
}

// ── Recipe CRUD ────────────────────────────────────────────

export function addRecipe(name: string): Recipe {
    return db.insert(recipes).values({ name }).returning().get();
}

export function updateRecipe(id: number, name: string) {
    db.update(recipes).set({ name }).where(eq(recipes.id, id)).run();
}

export function deleteRecipe(id: number) {
    db.delete(recipeItems).where(eq(recipeItems.recipe_id, id)).run();
    db.delete(recipes).where(eq(recipes.id, id)).run();
}

export function softDeleteRecipe(id: number) {
    db.update(recipes).set({ deleted: 1 }).where(eq(recipes.id, id)).run();
}

export function getAllRecipes(): Recipe[] {
    return db.select().from(recipes).where(eq(recipes.deleted, 0)).all();
}

export function searchRecipesByName(query: string): Recipe[] {
    return db
        .select()
        .from(recipes)
        .where(and(like(recipes.name, `%${query}%`), eq(recipes.deleted, 0)))
        .limit(30)
        .all();
}

export function getRecipeItems(recipeId: number) {
    return db
        .select()
        .from(recipeItems)
        .leftJoin(foods, eq(recipeItems.food_id, foods.id))
        .where(eq(recipeItems.recipe_id, recipeId))
        .all();
}

export function addRecipeItem(item: NewRecipeItem): RecipeItem {
    return db.insert(recipeItems).values(item).returning().get();
}

export function updateRecipeItem(id: number, values: Partial<NewRecipeItem>) {
    db.update(recipeItems).set(values).where(eq(recipeItems.id, id)).run();
}

export function deleteRecipeItem(id: number) {
    db.delete(recipeItems).where(eq(recipeItems.id, id)).run();
}

export function getRecipeById(id: number): Recipe | undefined {
    return db.select().from(recipes).where(eq(recipes.id, id)).get();
}

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
        // Check if all entries in this group are scheduled
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

    // Scale ALL entries (native + external) by the ratio so every
    // ingredient in the group stays proportional.
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

// ── Analytics ──────────────────────────────────────────────

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

// ── Notification Settings ──────────────────────────────────

export function getNotificationSettings(): NotificationSettings | undefined {
    return db.select().from(notificationSettings).where(eq(notificationSettings.id, 1)).get();
}

export function setNotificationSettings(values: Partial<Omit<NotificationSettings, "id">>) {
    db.update(notificationSettings).set(values).where(eq(notificationSettings.id, 1)).run();
}
