import { create } from "zustand";
import type { UnitSystem } from "@/src/types";

interface AppState {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    unitSystem: UnitSystem;
    setUnitSystem: (system: UnitSystem) => void;
}

export const useAppStore = create<AppState>((set) => ({
    selectedDate: new Date(),
    setSelectedDate: (date) => set({ selectedDate: date }),
    unitSystem: "metric",
    setUnitSystem: (system) => set({ unitSystem: system }),
}));
