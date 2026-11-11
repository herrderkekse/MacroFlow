import { getRecipeDisplayName } from "@/src/features/templates/services/recipeVariantsDb";
import { getRecipeById } from "@/src/features/templates/services/templateDb";
import type { IconName } from "@/src/shared/atoms/IconButton";
import MacroInline from "@/src/shared/components/MacroInline";
import SectionCard from "@/src/shared/components/SectionCard";
import type { MealType } from "@/src/shared/types";
import React from "react";
import { useTranslation } from "react-i18next";
import { getRecipeLogById } from "../services/logDb";
import MealEntryRow from "./MealEntryRow";
import type { EntryWithFood, MealSelectionContextValue, RecipeGroup } from "./mealSectionContext";
import { MealSelectionContext } from "./mealSectionContext";
import RecipeGroupRow from "./RecipeGroupRow";

export type { RecipeGroup } from "./mealSectionContext";

interface MealSectionProps {
    mealType: MealType;
    icon: string;
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
    icon,
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
    const totals = items.reduce(
        (sum, row) => {
            const food = row.foods;
            if (!food) return sum;
            const factor = row.entries.quantity_grams / 100;
            return {
                calories: sum.calories + food.calories_per_100g * factor,
                protein: sum.protein + food.protein_per_100g * factor,
                carbs: sum.carbs + food.carbs_per_100g * factor,
                fat: sum.fat + food.fat_per_100g * factor,
            };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

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
                icon={icon as IconName}
                title={t(`meal.${mealType}`)}
                summary={hasItems ? <MacroInline protein={totals.protein} carbs={totals.carbs} fat={totals.fat} /> : undefined}
                value={hasItems ? `${Math.round(totals.calories)} ${t("common.cal")}` : undefined}
                onAdd={selectionMode ? undefined : onAdd}
                addLabel={t("log.addFoodTo", { meal: t(`meal.${mealType}`) })}
                selected={allMealSelected}
                onHeaderPress={() => {
                    if (selectionMode && hasItems) onToggleEntries?.(allMealEntryIds);
                    else if (!selectionMode) onAdd();
                }}
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
