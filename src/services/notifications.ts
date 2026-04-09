import i18n from "@/src/i18n";
import { notificationSettings } from "@/src/services/db/schema";
import type { MealType } from "@/src/shared/types";
import logger from "@/src/utils/logger";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type NotifSettings = typeof notificationSettings.$inferSelect | null | undefined;

const MEAL_LABEL_KEYS: Record<MealType, string> = {
    breakfast: "settings.notificationBreakfast",
    lunch: "settings.notificationLunch",
    dinner: "settings.notificationDinner",
    snack: "settings.notificationSnack",
};

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
            await Notifications.cancelScheduledNotificationAsync(`${id}-${day}`).catch(() => { });
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
 * Schedules reminders for SCHEDULE_DAYS_AHEAD days and syncs today's state.
 * Call on app start and whenever settings change.
 */
export async function scheduleAllReminders(
    mealLabels: Record<MealType, string>,
    weightLabel: string,
    settings: NotifSettings,
    loggedMealTypes: Set<MealType>,
    hasWeightLog: boolean,
) {
    if (!settings?.enabled) {
        await cancelAllReminders();
        return;
    }

    await cancelAllReminders();

    const tasks: Promise<void>[] = [];
    if (settings.breakfast_enabled !== 0) tasks.push(scheduleMealReminder("breakfast", settings.breakfast_time, mealLabels.breakfast));
    if (settings.lunch_enabled !== 0) tasks.push(scheduleMealReminder("lunch", settings.lunch_time, mealLabels.lunch));
    if (settings.dinner_enabled !== 0) tasks.push(scheduleMealReminder("dinner", settings.dinner_time, mealLabels.dinner));
    if (settings.snack_enabled !== 0) tasks.push(scheduleMealReminder("snack", settings.snack_time, mealLabels.snack));
    if (settings.weight_enabled !== 0) tasks.push(scheduleWeightReminder(settings.weight_time, weightLabel));
    await Promise.all(tasks);

    // Cancel today's reminders for meals / weight already logged
    await syncTodayMealReminders(settings, loggedMealTypes);
    await cancelWeightReminderIfLogged(hasWeightLog);

    logger.info("[Notifications] Scheduled reminders for the next week");
}

/**
 * Cancel today's reminder for a specific meal if the user has already logged food for it.
 */
export async function cancelMealReminderIfLogged(mealType: MealType, hasEntry: boolean) {
    if (!hasEntry) return;
    await Notifications.cancelScheduledNotificationAsync(`${MEAL_IDS[mealType]}-0`).catch(() => { });
    logger.info(`[Notifications] Cancelled today's ${mealType} reminder (food logged)`);
}

/**
 * Sync today's meal reminders with the current log state.
 * Cancels reminders for meals that have entries, and re-schedules
 * reminders for meals that are now empty (e.g. after deleting a food).
 */
export async function syncTodayMealReminders(settings: NotifSettings, loggedMealTypes: Set<MealType>) {
    if (!settings?.enabled) return;

    const now = new Date();
    const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
    for (const mealType of mealTypes) {
        const enabledKey = `${mealType}_enabled` as keyof typeof settings;
        if (settings[enabledKey] === 0) continue;

        const hasEntry = loggedMealTypes.has(mealType);
        const id = `${MEAL_IDS[mealType]}-0`;

        if (hasEntry) {
            await Notifications.cancelScheduledNotificationAsync(id).catch(() => { });
        } else {
            // Re-schedule today's reminder if the time hasn't passed
            const timeKey = `${mealType}_time` as keyof typeof settings;
            const time = settings[timeKey] as string;
            const { hour, minute } = parseTime(time);

            const triggerDate = new Date(now);
            triggerDate.setHours(hour, minute, 0, 0);

            if (triggerDate.getTime() > now.getTime()) {
                const mealLabel = i18n.t(MEAL_LABEL_KEYS[mealType]);
                await Notifications.scheduleNotificationAsync({
                    identifier: id,
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
                logger.info(`[Notifications] Re-scheduled today's ${mealType} reminder (meal now empty)`);
            }
        }
    }
}

/**
 * Cancel today's weight reminder if the user has already logged weight.
 */
export async function cancelWeightReminderIfLogged(hasWeightLog: boolean) {
    if (!hasWeightLog) return;
    await Notifications.cancelScheduledNotificationAsync(`${WEIGHT_ID}-0`).catch(() => { });
    logger.info("[Notifications] Cancelled today's weight reminder (weight logged)");
}

/**
 * Sync today's weight reminder with the current log state.
 * Re-schedules the reminder if no weight has been logged today.
 */
export async function syncTodayWeightReminder(settings: NotifSettings, hasWeightLog: boolean) {
    if (!settings?.enabled || settings.weight_enabled === 0) return;

    const now = new Date();
    if (hasWeightLog) {
        await Notifications.cancelScheduledNotificationAsync(`${WEIGHT_ID}-0`).catch(() => { });
    } else {
        const { hour, minute } = parseTime(settings.weight_time);
        const triggerDate = new Date(now);
        triggerDate.setHours(hour, minute, 0, 0);

        if (triggerDate.getTime() > now.getTime()) {
            const weightLabel = i18n.t("settings.notificationWeight");
            await Notifications.scheduleNotificationAsync({
                identifier: `${WEIGHT_ID}-0`,
                content: {
                    title: "MacroFlow",
                    body: `⚖️ ${weightLabel}`,
                    ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                },
            });
            logger.info("[Notifications] Re-scheduled today's weight reminder (no weight logged)");
        }
    }
}
