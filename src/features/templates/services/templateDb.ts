import { db } from "@/src/services/db";
import { entries, foods, recipeItems, recipes, servingUnits } from "@/src/services/db/schema";
import { and, eq, like, sql } from "drizzle-orm";

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type NewRecipeItem = typeof recipeItems.$inferInsert;
export type ServingUnit = typeof servingUnits.$inferSelect;
export type NewServingUnit = typeof servingUnits.$inferInsert;

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

export function getRecipeItemById(id: number): RecipeItem | undefined {
    return db.select().from(recipeItems).where(eq(recipeItems.id, id)).get();
}
