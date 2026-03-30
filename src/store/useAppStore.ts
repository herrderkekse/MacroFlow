import type { AppearanceMode, Language, UnitSystem } from "@/src/types";
import { normalizeCalendarDate } from "@/src/utils/date";
import { create } from "zustand";
import i18n, { defaultLanguage } from "@/src/i18n";

interface AppState {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    unitSystem: UnitSystem;
    setUnitSystem: (system: UnitSystem) => void;
    appearanceMode: AppearanceMode;
    setAppearanceMode: (mode: AppearanceMode) => void;
    language: Language;
    setLanguage: (lang: Language) => void;
}

export const useAppStore = create<AppState>((set) => ({
    selectedDate: normalizeCalendarDate(new Date()),
    setSelectedDate: (date) => set({ selectedDate: normalizeCalendarDate(date) }),
    unitSystem: "metric",
    setUnitSystem: (system) => set({ unitSystem: system }),
    appearanceMode: "system",
    setAppearanceMode: (mode) => set({ appearanceMode: mode }),
    language: defaultLanguage,
    setLanguage: (lang) => {
        i18n.changeLanguage(lang);
        set({ language: lang });
    },
}));
