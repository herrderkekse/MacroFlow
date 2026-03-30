import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initDB } from "../src/db";
import { getGoals } from "../src/db/queries";
import "../src/i18n";
import i18n from "../src/i18n";
import { useAppStore } from "../src/store/useAppStore";
import type { AppearanceMode, Language, MealType, UnitSystem } from "../src/types";
import { ThemeProvider, useThemeColors } from "../src/utils/ThemeProvider";
import { useEffect } from "react";
import { scheduleAllReminders } from "../src/services/notifications";

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
    scheduleAllReminders(mealLabels, i18n.t("settings.notificationWeight"));
  }, []);

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
