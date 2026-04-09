import { db } from "@/src/services/db";
import { goals, notificationSettings } from "@/src/services/db/schema";
import { eq } from "drizzle-orm";

export type Goals = typeof goals.$inferSelect;
export type NotificationSettings = typeof notificationSettings.$inferSelect;

// ── Goals ──────────────────────────────────────────────────

export function getGoals(): Goals | undefined {
    return db.select().from(goals).where(eq(goals.id, 1)).get();
}

export function setGoals(values: Partial<Omit<Goals, "id">>) {
    db.update(goals).set(values).where(eq(goals.id, 1)).run();
}

// ── Notification Settings ──────────────────────────────────

export function getNotificationSettings(): NotificationSettings | undefined {
    return db.select().from(notificationSettings).where(eq(notificationSettings.id, 1)).get();
}

export function setNotificationSettings(values: Partial<Omit<NotificationSettings, "id">>) {
    db.update(notificationSettings).set(values).where(eq(notificationSettings.id, 1)).run();
}
