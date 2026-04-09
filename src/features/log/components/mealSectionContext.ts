import type { EntryWithFood, RecipeGroup } from "../services/logDb";
import { createContext, useContext } from "react";

export type { EntryWithFood, RecipeGroup };

export interface MealSelectionContextValue {
    selectionMode: boolean;
    selectedEntryIds: Set<number>;
    toggleEntries: (entryIds: number[]) => void;
    activateSelection: (entryId: number) => void;
    activateSelectionMultiple: (entryIds: number[]) => void;
}

export const MealSelectionContext = createContext<MealSelectionContextValue | null>(null);

export function useMealSelection() {
    return useContext(MealSelectionContext);
}
