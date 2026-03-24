import type { AppearanceMode, UnitSystem } from "@/src/types";
import { create } from "zustand";

interface AppState {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    unitSystem: UnitSystem;
    setUnitSystem: (system: UnitSystem) => void;
    appearanceMode: AppearanceMode;
    setAppearanceMode: (mode: AppearanceMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
    selectedDate: new Date(),
    setSelectedDate: (date) => set({ selectedDate: date }),
    unitSystem: "metric",
    setUnitSystem: (system) => set({ unitSystem: system }),
    appearanceMode: "system",
    setAppearanceMode: (mode) => set({ appearanceMode: mode }),
}));
