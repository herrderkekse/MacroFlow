import { eq, and, gte, lt, like } from "drizzle-orm";
import { db } from "./index";
import { foods, entries, goals } from "./schema";

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Goals = typeof goals.$inferSelect;

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

export function getEntriesByDate(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return db
        .select()
        .from(entries)
        .leftJoin(foods, eq(entries.food_id, foods.id))
        .where(and(gte(entries.timestamp, start.getTime()), lt(entries.timestamp, end.getTime())))
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
