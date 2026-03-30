import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getEntriesByDate, getNotificationSettings, getWeightLogsForDate } from "../db/queries";
import type { MealType } from "../types";
import logger from "../utils/logger";

// ── Channel IDs used as notification identifiers ────────────
const MEAL_IDS: Record<MealType, string> = {
    breakfast: "reminder-breakfast",
    lunch: "reminder-lunch",
    dinner: "reminder-dinner",
    snack: "reminder-snack",
};
const WEIGHT_ID = "reminder-weight";
const SCHEDULE_DAYS_AHEAD = 7;

// ── Setup ──────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("reminders", {
            name: "Meal Reminders",
            importance: Notifications.AndroidImportance.HIGH,
        });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
}

// ── Parse "HH:MM" strings ──────────────────────────────────

function parseTime(time: string): { hour: number; minute: number } {
    const [h, m] = time.split(":").map(Number);
    return { hour: h ?? 0, minute: m ?? 0 };
}

// ── Schedule / Cancel ──────────────────────────────────────

export async function cancelAllReminders() {
    const ids = [...Object.values(MEAL_IDS), WEIGHT_ID];
    for (const id of ids) {
        for (let day = 0; day < SCHEDULE_DAYS_AHEAD; day++) {
            await Notifications.cancelScheduledNotificationAsync(`${id}-${day}`).catch(() => {});
        }
    }
    logger.info("[Notifications] Cancelled all reminders");
}

async function scheduleMealReminder(
    mealType: MealType,
    time: string,
    mealLabel: string,
) {
    const { hour, minute } = parseTime(time);
    const now = new Date();

    for (let day = 0; day < SCHEDULE_DAYS_AHEAD; day++) {
        const triggerDate = new Date(now);
        triggerDate.setDate(triggerDate.getDate() + day);
        triggerDate.setHours(hour, minute, 0, 0);

        if (triggerDate.getTime() <= now.getTime()) continue;

        await Notifications.scheduleNotificationAsync({
            identifier: `${MEAL_IDS[mealType]}-${day}`,
            content: {
                title: "MacroFlow",
                body: `🍽️ ${mealLabel}`,
                ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
            },
        });
    }
}

async function scheduleWeightReminder(time: string, label: string) {
    const { hour, minute } = parseTime(time);
    const now = new Date();

    for (let day = 0; day < SCHEDULE_DAYS_AHEAD; day++) {
        const triggerDate = new Date(now);
        triggerDate.setDate(triggerDate.getDate() + day);
        triggerDate.setHours(hour, minute, 0, 0);

        if (triggerDate.getTime() <= now.getTime()) continue;

        await Notifications.scheduleNotificationAsync({
            identifier: `${WEIGHT_ID}-${day}`,
            content: {
                title: "MacroFlow",
                body: `⚖️ ${label}`,
                ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
            },
        });
    }
}

/**
 * Reads notification settings from DB and schedules reminders for
 * SCHEDULE_DAYS_AHEAD days into the future. Call on app start and
 * whenever settings change.
 */
export async function scheduleAllReminders(mealLabels: Record<MealType, string>, weightLabel: string) {
    const settings = getNotificationSettings();
    if (!settings?.enabled) {
        await cancelAllReminders();
        return;
    }

    await cancelAllReminders();

    await Promise.all([
        scheduleMealReminder("breakfast", settings.breakfast_time, mealLabels.breakfast),
        scheduleMealReminder("lunch", settings.lunch_time, mealLabels.lunch),
        scheduleMealReminder("dinner", settings.dinner_time, mealLabels.dinner),
        scheduleMealReminder("snack", settings.snack_time, mealLabels.snack),
        scheduleWeightReminder(settings.weight_time, weightLabel),
    ]);

    logger.info("[Notifications] Scheduled reminders for the next week");
}

/**
 * Cancel today's reminder for a specific meal if the user has already logged
 * food for it.
 */
export async function cancelMealReminderIfLogged(mealType: MealType) {
    const settings = getNotificationSettings();
    if (!settings?.enabled) return;

    const today = new Date();
    const entries = getEntriesByDate(today);
    const hasEntry = entries.some((r) => r.entries.meal_type === mealType);

    if (hasEntry) {
        // Day 0 is today's notification
        await Notifications.cancelScheduledNotificationAsync(`${MEAL_IDS[mealType]}-0`).catch(() => {});
        logger.info(`[Notifications] Cancelled today's ${mealType} reminder (food logged)`);
    }
}

/**
 * Cancel today's weight reminder if the user has already logged weight.
 */
export async function cancelWeightReminderIfLogged() {
    const settings = getNotificationSettings();
    if (!settings?.enabled) return;

    const today = new Date();
    const logs = getWeightLogsForDate(today);
    if (logs.length > 0) {
        await Notifications.cancelScheduledNotificationAsync(`${WEIGHT_ID}-0`).catch(() => {});
        logger.info("[Notifications] Cancelled today's weight reminder (weight logged)");
    }
}
