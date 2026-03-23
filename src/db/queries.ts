import { eq, like } from "drizzle-orm";
import { db } from "./index";
import { foods, entries, goals, recipes, recipeItems } from "./schema";

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Goals = typeof goals.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type NewRecipeItem = typeof recipeItems.$inferInsert;

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

export function logRecipeToMeal(
    recipeId: number,
    mealType: string,
    date: string,
    group: string,
) {
    const items = getRecipeItems(recipeId);
    const ts = Date.now();
    for (const row of items) {
        db.insert(entries)
            .values({
                food_id: row.recipe_items.food_id,
                quantity_grams: row.recipe_items.quantity_grams,
                quantity_unit: row.recipe_items.quantity_unit ?? "g",
                timestamp: ts,
                date,
                meal_type: mealType,
                recipe_id: recipeId,
                recipe_log_group: group,
            })
            .run();
    }
}
