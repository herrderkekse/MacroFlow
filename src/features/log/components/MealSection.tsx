import { getRecipeDisplayName } from "@/src/features/templates/services/recipeVariantsDb";
import { getRecipeById } from "@/src/features/templates/services/templateDb";
import MacroNumbers from "@/src/shared/components/MacroNumbers";
import SectionCard from "@/src/shared/components/SectionCard";
import type { MealType } from "@/src/shared/types";
import React from "react";
import { useTranslation } from "react-i18next";
import { sumMacros } from "../helpers/logHelpers";
import { getRecipeLogById } from "../services/logDb";
import MealEntryRow from "./MealEntryRow";
import type { EntryWithFood, MealSelectionContextValue, RecipeGroup } from "./mealSectionContext";
import { MealSelectionContext } from "./mealSectionContext";
import RecipeGroupRow from "./RecipeGroupRow";

export type { RecipeGroup } from "./mealSectionContext";

interface MealSectionProps {
    mealType: MealType;
    /** The first section of the day sits closer to the header. */
    first?: boolean;
    items: EntryWithFood[];
    onAdd: () => void;
    onEdit?: (row: EntryWithFood) => void;
    onEditRecipeGroup?: (group: RecipeGroup, currentMultiplier: number) => void;
    onDeleteRecipeLog?: (recipeLogId: number) => void;
    onConfirmEntry?: (id: number) => void;
    onConfirmRecipeLog?: (recipeLogId: number) => void;
    selectionMode?: boolean;
    selectedEntryIds?: Set<number>;
    onToggleEntries?: (entryIds: number[]) => void;
    onActivateSelection?: (entryId: number) => void;
    onActivateSelectionMultiple?: (entryIds: number[]) => void;
}

function groupEntries(items: EntryWithFood[]) {
    const standalone: EntryWithFood[] = [];
    const recipeMap = new Map<number, EntryWithFood[]>();

    for (const item of items) {
        const rlId = item.entries.recipe_log_id;
        if (rlId) {
            const list = recipeMap.get(rlId) ?? [];
            list.push(item);
            recipeMap.set(rlId, list);
        } else {
            standalone.push(item);
        }
    }

    const recipeGroups: RecipeGroup[] = [];
    for (const [recipeLogId, rows] of recipeMap) {
        const recipeLog = getRecipeLogById(recipeLogId);
        if (!recipeLog) {
            standalone.push(...rows);
            continue;
        }
        const recipe = getRecipeById(recipeLog.recipe_id);
        const display = recipe ? getRecipeDisplayName(recipe) : null;
        recipeGroups.push({
            recipeLogId,
            recipeId: recipeLog.recipe_id,
            recipeName: display?.name ?? "Recipe",
            recipeVariant: display?.variant ?? null,
            portion: recipeLog.portion,
            rows,
        });
    }

    return { standalone, recipeGroups };
}

export default function MealSection({
    mealType,
    first,
    items,
    onAdd,
    onEdit,
    onEditRecipeGroup,
    onDeleteRecipeLog,
    onConfirmEntry,
    onConfirmRecipeLog,
    selectionMode,
    selectedEntryIds,
    onToggleEntries,
    onActivateSelection,
    onActivateSelectionMultiple,
}: MealSectionProps) {
    const { t } = useTranslation();
    const totals = sumMacros(items);

    const { standalone, recipeGroups } = groupEntries(items);
    const allMealEntryIds = items.map(e => e.entries.id);
    const allMealSelected = !!selectionMode && items.length > 0 && items.every(e => !!selectedEntryIds?.has(e.entries.id));
    const selectionContextValue: MealSelectionContextValue = {
        selectionMode: selectionMode ?? false,
        selectedEntryIds: selectedEntryIds ?? new Set<number>(),
        toggleEntries: (entryIds) => onToggleEntries?.(entryIds),
        activateSelection: (entryId) => onActivateSelection?.(entryId),
        activateSelectionMultiple: (entryIds) => onActivateSelectionMultiple?.(entryIds),
    };

    const hasItems = items.length > 0;

    return (
        <MealSelectionContext.Provider value={selectionContextValue}>
            <SectionCard
                first={first}
                title={t(`meal.${mealType}`)}
                aside={hasItems ? <MacroNumbers size="sm" {...totals} /> : undefined}
                onAdd={selectionMode ? undefined : onAdd}
                addLabel={t("log.addFoodTo", { meal: t(`meal.${mealType}`) })}
                empty={selectionMode ? undefined : { icon: "add", label: t("log.nothingLogged") }}
                selected={allMealSelected}
                onHeaderPress={selectionMode && hasItems ? () => onToggleEntries?.(allMealEntryIds) : undefined}
                onHeaderLongPress={() => {
                    if (selectionMode && hasItems) onToggleEntries?.(allMealEntryIds);
                    else if (!selectionMode && hasItems) onActivateSelectionMultiple?.(allMealEntryIds);
                }}
            >
                {recipeGroups.map((rg, index) => (
                    <RecipeGroupRow
                        key={rg.recipeLogId}
                        group={rg}
                        onEdit={onEdit}
                        onEditRecipeGroup={onEditRecipeGroup}
                        onDeleteRecipeLog={onDeleteRecipeLog}
                        onConfirmRecipeLog={onConfirmRecipeLog}
                        isFirst={index === 0}
                    />
                ))}
                {standalone.map((row, index) => (
                    <MealEntryRow
                        key={row.entries.id}
                        row={row}
                        onEdit={onEdit}
                        onConfirmEntry={onConfirmEntry}
                        isFirst={index === 0 && recipeGroups.length === 0}
                    />
                ))}
            </SectionCard>
        </MealSelectionContext.Provider>
    );
}
