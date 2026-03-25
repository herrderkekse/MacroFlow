import { and, eq, like, sql } from "drizzle-orm";
import logger from "../utils/logger";
import { db } from "./index";
import { entries, foods, goals, recipeItems, recipeLogs, recipes } from "./schema";

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

// ── Food CRUD ──────────────────────────────────────────────

export function addFood(food: NewFood): Food {
    return db.insert(foods).values(food).returning().get();
}

export function searchFoodsByName(query: string): Food[] {
    return db
        .select()
        .from(foods)
        .where(like(foods.name, `%${query}%`))
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

// ── Entry CRUD ─────────────────────────────────────────────

export function addEntry(entry: NewEntry): Entry {
    return db.insert(entries).values(entry).returning().get();
}

export function formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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

export function updateEntry(id: number, values: Partial<NewEntry>) {
    db.update(entries).set(values).where(eq(entries.id, id)).run();
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

export function getAllRecipes(): Recipe[] {
    return db.select().from(recipes).all();
}

export function searchRecipesByName(query: string): Recipe[] {
    return db
        .select()
        .from(recipes)
        .where(like(recipes.name, `%${query}%`))
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
    const yesterdayStr = toDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const last = rows[0].date;
    console.log("last entry date until today:", last, "today:", todayStr, "yesterday:", yesterdayStr);
    if (last !== todayStr) {
        console.log("Last entry is not from today, streak reset to 0.");
        return 0;
    }

    let streak = 1;
    for (let i = 1; i < rows.length; i++) {
        const curr = new Date(rows[i - 1].date + "T00:00:00");
        const prev = new Date(rows[i].date + "T00:00:00");
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        console.log(`Comparing ${toDateStr(prev)} and ${toDateStr(curr)}. Diff in days:`, diff);
        if (Math.round(diff) === 1) {
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
        return {
            recipeLogId: row.recipeLogId,
            recipeId: row.recipeId,
            recipeName: recipe?.name ?? "Recipe",
            portion: row.portion,
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
