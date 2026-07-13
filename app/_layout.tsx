import "@/polyfills";
import { isWorkoutScreenVisible, REST_TIMER_NOTIFICATION_ID, shouldPlayTimerSound } from "@/src/features/exercise/services/restTimerNotifications";
import { getEntriesByDate, getWeightLogsForDate } from "@/src/features/log/services/logDb";
import { createAutoBackup } from "@/src/features/settings/services/autoBackup";
import { getGoals, getNotificationSettings } from "@/src/features/settings/services/settingsDb";
import { syncIfConfigured } from "@/src/features/settings/services/syncEngine";
import i18n from "@/src/i18n";
import { initDB } from "@/src/services/db";
import { deactivateKeepAwakeAsync, KEEP_AWAKE_DEFAULT_TAG, WORKOUT_KEEP_AWAKE_TAG } from "@/src/services/keepAwake";
import { scheduleAllReminders } from "@/src/services/notifications";
import { ThemeProvider, useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import type { AppearanceMode, Language, MealType, UnitSystem } from "@/src/shared/types";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Stack, usePathname } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Foreground notification behavior: show the rest-timer notification unless the
// user is already watching the workout screen (where the in-app timer chimes
// itself). Everything else keeps the pre-handler default of not presenting.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const showRestTimer =
      notification.request.identifier === REST_TIMER_NOTIFICATION_ID && !isWorkoutScreenVisible();
    return {
      shouldShowBanner: showRestTimer,
      shouldShowList: showRestTimer,
      shouldPlaySound: showRestTimer && (await shouldPlayTimerSound()),
      shouldSetBadge: false,
    };
  },
});

const LAST_SEEN_VERSION_KEY = "last_seen_app_version";
const currentVersion = Constants.expoConfig?.version ?? "0.0.0";
const lastSeenVersion = SecureStore.getItem(LAST_SEEN_VERSION_KEY);

if (lastSeenVersion !== currentVersion) {
  try {
    createAutoBackup();
  } catch { /* best-effort */ }
  SecureStore.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
}

initDB();

function InnerLayout() {
  const colors = useThemeColors();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setAppearanceMode = useAppStore((s) => s.setAppearanceMode);
  const setUnitSystem = useAppStore((s) => s.setUnitSystem);
  const setKeepAwakeInWorkout = useAppStore((s) => s.setKeepAwakeInWorkout);
  const keepAwakeInWorkout = useAppStore((s) => s.keepAwakeInWorkout);
  const setExerciseTimerSound = useAppStore((s) => s.setExerciseTimerSound);
  const pathname = usePathname();

  useEffect(() => {
    const goals = getGoals();
    if (goals?.language) {
      const lang = goals.language as Language;
      setLanguage(lang);
      i18n.changeLanguage(lang);
    }
    if (goals?.appearance_mode === "light" || goals?.appearance_mode === "dark" || goals?.appearance_mode === "system") {
      setAppearanceMode(goals.appearance_mode as AppearanceMode);
    }
    if (goals?.unit_system === "metric" || goals?.unit_system === "imperial") {
      setUnitSystem(goals.unit_system as UnitSystem);
    }
    setKeepAwakeInWorkout(goals?.keep_awake === 1);
    if (goals?.exercise_timer_sound === "off" || goals?.exercise_timer_sound === "on" || goals?.exercise_timer_sound === "bluetooth") {
      setExerciseTimerSound(goals.exercise_timer_sound);
    }

    // Schedule notification reminders on app start
    const mealLabels: Record<MealType, string> = {
      breakfast: i18n.t("settings.notificationBreakfast"),
      lunch: i18n.t("settings.notificationLunch"),
      dinner: i18n.t("settings.notificationDinner"),
      snack: i18n.t("settings.notificationSnack"),
    };
    scheduleAllReminders(mealLabels, i18n.t("settings.notificationWeight"), getNotificationSettings() ?? null, new Set(getEntriesByDate(new Date()).map(e => e.entries.meal_type as MealType)), getWeightLogsForDate(new Date()).length > 0);
  }, [setLanguage, setAppearanceMode, setUnitSystem, setKeepAwakeInWorkout, setExerciseTimerSound]);

  // Best-effort background sync on app start and whenever the app returns to
  // the foreground; a no-op while sync is unconfigured or the device is offline.
  useEffect(() => {
    void syncIfConfigured();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncIfConfigured();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const isWorkoutRoute = pathname?.startsWith("/workout") ?? false;
    const shouldAllowKeepAwake = isWorkoutRoute && keepAwakeInWorkout;
    if (shouldAllowKeepAwake) return;

    const releaseKeepAwake = () => {
      void deactivateKeepAwakeAsync(WORKOUT_KEEP_AWAKE_TAG).catch(() => { });
      void deactivateKeepAwakeAsync(KEEP_AWAKE_DEFAULT_TAG).catch(() => { });
    };

    releaseKeepAwake();

    const interval = setInterval(releaseKeepAwake, 3000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        releaseKeepAwake();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [keepAwakeInWorkout, pathname]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <InnerLayout />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
