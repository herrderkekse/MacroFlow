import { isBluetoothAudioConnected } from "@/modules/audio-output";
import i18n from "@/src/i18n";
import { useAppStore } from "@/src/shared/store/useAppStore";
import logger from "@/src/utils/logger";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const REST_TIMER_NOTIFICATION_ID = "rest-timer";

const CHANNEL_SOUND = "rest-timer";
const CHANNEL_SILENT = "rest-timer-silent";
// Bundled via the expo-notifications config plugin (app.json "sounds")
const NOTIFICATION_SOUND = "rest_timer_done.wav";

// ── Workout screen visibility ──────────────────────────────
// Tracked so the foreground notification handler can suppress the rest-timer
// notification while the user is already looking at the workout screen.

let workoutScreenVisible = false;

export function setWorkoutScreenVisible(visible: boolean) {
    workoutScreenVisible = visible;
}

export function isWorkoutScreenVisible(): boolean {
    return workoutScreenVisible;
}

// ── Sound setting ──────────────────────────────────────────

/**
 * Whether the timer-finished sound should play right now, per the
 * exercise timer sound setting (off / on / bluetooth).
 */
export async function shouldPlayTimerSound(): Promise<boolean> {
    const setting = useAppStore.getState().exerciseTimerSound;
    if (setting === "on") return true;
    if (setting === "bluetooth") return isBluetoothAudioConnected();
    return false;
}

// ── Setup ──────────────────────────────────────────────────

let channelsReady = false;

async function ensureAndroidChannels() {
    if (Platform.OS !== "android" || channelsReady) return;
    await Notifications.setNotificationChannelAsync(CHANNEL_SOUND, {
        name: "Rest Timer",
        importance: Notifications.AndroidImportance.HIGH,
        sound: NOTIFICATION_SOUND,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_SILENT, {
        name: "Rest Timer (silent)",
        importance: Notifications.AndroidImportance.HIGH,
        sound: null,
    });
    channelsReady = true;
}

let permissionRequested = false;

async function requestPermissionsNow(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    const { status: afterRequest } = await Notifications.requestPermissionsAsync();
    return afterRequest === "granted";
}

/**
 * Prompt for notification permission in response to an explicit user action —
 * e.g. enabling the timer sound in Settings. Unlike the implicit scheduling
 * path, this always reflects the current OS state and prepares the channels.
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    await ensureAndroidChannels();
    return requestPermissionsNow();
}

/** Returns whether notifications are permitted, prompting at most once per app session. */
async function ensurePermission(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    if (permissionRequested) return false;
    permissionRequested = true;
    const { status: afterRequest } = await Notifications.requestPermissionsAsync();
    return afterRequest === "granted";
}

// ── Schedule / Cancel ──────────────────────────────────────

/**
 * Schedule (or replace — the identifier is fixed) the "rest over" notification.
 * The sound decision (setting + Bluetooth connectivity) is captured at schedule
 * time, which is at most one rest period before it fires.
 */
export async function scheduleRestTimerNotification(fireAtEpoch: number) {
    try {
        if (Platform.OS === "web" || fireAtEpoch <= Date.now()) return;
        if (!(await ensurePermission())) return;
        await ensureAndroidChannels();

        const withSound = await shouldPlayTimerSound();
        await Notifications.scheduleNotificationAsync({
            identifier: REST_TIMER_NOTIFICATION_ID,
            content: {
                title: i18n.t("exercise.restTimer.notificationTitle"),
                body: i18n.t("exercise.restTimer.notificationBody"),
                sound: withSound ? NOTIFICATION_SOUND : false,
                ...(Platform.OS === "android"
                    ? { channelId: withSound ? CHANNEL_SOUND : CHANNEL_SILENT }
                    : {}),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(fireAtEpoch),
            },
        });
    } catch (e) {
        logger.warn("[RestTimer] Failed to schedule notification", e instanceof Error ? e.message : e);
    }
}

/** Cancel the pending notification and dismiss it if it was already delivered. */
export async function cancelRestTimerNotification() {
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => { });
    await Notifications.dismissNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => { });
}
