import { db } from "@/src/services/db";
import { goalHistory, goals, notificationSettings } from "@/src/services/db/schema";
import { desc, eq, lte } from "drizzle-orm";

export type Goals = typeof goals.$inferSelect;
export type NotificationSettings = typeof notificationSettings.$inferSelect;

/** The macro-nutrition subset of goals that is tracked historically per day. */
export type NutritionGoals = Pick<Goals, "calories" | "protein" | "carbs" | "fat">;

// ── Goals ──────────────────────────────────────────────────

export function getGoals(): Goals | undefined {
    return db.select().from(goals).where(eq(goals.id, 1)).get();
}

export function setGoals(values: Partial<Omit<Goals, "id">>) {
    db.update(goals).set(values).where(eq(goals.id, 1)).run();
}

/**
 * Save nutrition goals and record them in the history as effective from
 * `dateKey` onward. Changing goals multiple times on one day overwrites that
 * day's snapshot, so only the last save of the day counts.
 */
export function setNutritionGoals(values: NutritionGoals, dateKey: string) {
    setGoals(values);
    db.delete(goalHistory).where(eq(goalHistory.date, dateKey)).run();
    db.insert(goalHistory).values({ ...values, date: dateKey }).run();
}

/**
 * Resolve the nutrition goals that were active on a given day: the most recent
 * history snapshot with date <= `dateKey`. Falls back to the current goals when
 * no snapshot precedes the day (e.g. days before any goal was ever recorded).
 */
export function getGoalsForDate(dateKey: string): Goals | undefined {
    const current = getGoals();
    if (!current) return undefined;
    const snapshot = db
        .select()
        .from(goalHistory)
        .where(lte(goalHistory.date, dateKey))
        .orderBy(desc(goalHistory.date), desc(goalHistory.id))
        .limit(1)
        .get();
    if (!snapshot) return current;
    const { calories, protein, carbs, fat } = snapshot;
    return { ...current, calories, protein, carbs, fat };
}

// ── Notification Settings ──────────────────────────────────

export function getNotificationSettings(): NotificationSettings | undefined {
    return db.select().from(notificationSettings).where(eq(notificationSettings.id, 1)).get();
}

export function setNotificationSettings(values: Partial<Omit<NotificationSettings, "id">>) {
    db.update(notificationSettings).set(values).where(eq(notificationSettings.id, 1)).run();
}
