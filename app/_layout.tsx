import "@/polyfills";
import { getGoals, getNotificationSettings } from "@/src/features/settings/services/settingsDb";
import { createAutoBackup } from "@/src/features/settings/services/autoBackup";
import { getEntriesByDate, getWeightLogsForDate } from "@/src/features/log/services/logDb";
import i18n from "@/src/i18n";
import { initDB } from "@/src/services/db";
import { scheduleAllReminders } from "@/src/services/notifications";
import { ThemeProvider, useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import type { AppearanceMode, Language, MealType, UnitSystem } from "@/src/shared/types";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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

    // Schedule notification reminders on app start
    const mealLabels: Record<MealType, string> = {
      breakfast: i18n.t("settings.notificationBreakfast"),
      lunch: i18n.t("settings.notificationLunch"),
      dinner: i18n.t("settings.notificationDinner"),
      snack: i18n.t("settings.notificationSnack"),
    };
    scheduleAllReminders(mealLabels, i18n.t("settings.notificationWeight"), getNotificationSettings() ?? null, new Set(getEntriesByDate(new Date()).map(e => e.entries.meal_type as MealType)), getWeightLogsForDate(new Date()).length > 0);
  }, [setLanguage, setAppearanceMode, setUnitSystem]);

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
