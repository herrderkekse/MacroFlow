import { create } from "zustand";

interface AppState {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
}

export const useAppStore = create<AppState>((set) => ({
    selectedDate: new Date(),
    setSelectedDate: (date) => set({ selectedDate: date }),
}));
