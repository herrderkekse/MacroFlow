// eslint-disable-next-line boundaries/dependencies
import WorkoutSummarySection from "@/src/features/exercise/components/WorkoutSummarySection";
import type { Goals } from "@/src/features/settings/services/settingsDb";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import { spacing } from "@/src/utils/theme";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import DailyProgressBar from "../components/DailyProgressBar";
import { computeTotals, type EntryWithFood } from "../helpers/logHelpers";
import type { WeightLog } from "../services/logDb";
import LogPhotosSection from "./LogPhotosSection";
import type { RecipeGroup } from "./MealSection";
import MealSection from "./MealSection";
import WeightSection from "./WeightSection";

interface LogDayPageProps {
    width: number;
    grouped: Record<MealType, EntryWithFood[]>;
    goals: Goals;
    onAdd: (mt: MealType) => void;
    onDelete: (id: number) => void;
    onEdit: (row: EntryWithFood) => void;
    onEditRecipeGroup: (group: RecipeGroup, multiplier: number) => void;
    onDeleteRecipeLog: (recipeLogId: number) => void;
    onConfirmEntry?: (id: number) => void;
    onConfirmRecipeLog?: (recipeLogId: number) => void;
    selectionMode?: boolean;
    selectedEntryIds?: Set<number>;
    onToggleEntries?: (entryIds: number[]) => void;
    onActivateSelection?: (entryId: number) => void;
    onActivateSelectionMultiple?: (entryIds: number[]) => void;
    meanWeightKg?: number | null;
    weightTrend?: "up" | "down" | "flat" | null;
    weightDaysAgo?: number | null;
    weightLogs?: WeightLog[];
    onAddWeight?: (weightKg: number) => void;
    onDeleteWeight?: (id: number) => void;
    dateKey?: string;
    onQuickAdd?: () => void;
    workoutRefreshKey?: number;
}

export default function LogDayPage({
    width,
    grouped,
    goals,
    onAdd,
    onDelete,
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
    meanWeightKg,
    weightTrend,
    weightDaysAgo,
    weightLogs,
    onAddWeight,
    onDeleteWeight,
    dateKey,
    onQuickAdd,
    workoutRefreshKey,
}: LogDayPageProps) {
    const totals = computeTotals(grouped);
    const hasWeightLogs = (weightLogs?.length ?? 0) > 0;

    return (
        <View style={[styles.dayPage, { width }]}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                <DailyProgressBar totals={totals} scheduledTotals={totals.scheduled} goals={goals} meanWeightKg={meanWeightKg} weightTrend={weightTrend} weightDaysAgo={weightDaysAgo} />
                {MEAL_TYPES.map((meal) => (
                    <MealSection
                        key={meal.key}
                        mealType={meal.key}
                        icon={meal.icon}
                        items={grouped[meal.key]}
                        onAdd={() => onAdd(meal.key)}
                        onDeleteEntry={onDelete}
                        onEdit={onEdit}
                        onEditRecipeGroup={onEditRecipeGroup}
                        onDeleteRecipeLog={onDeleteRecipeLog}
                        onConfirmEntry={onConfirmEntry}
                        onConfirmRecipeLog={onConfirmRecipeLog}
                        selectionMode={selectionMode}
                        selectedEntryIds={selectedEntryIds}
                        onToggleEntries={onToggleEntries}
                        onActivateSelection={onActivateSelection}
                        onActivateSelectionMultiple={onActivateSelectionMultiple}
                    />
                ))}
                {hasWeightLogs && <WeightSection weights={weightLogs ?? []} onAdd={onAddWeight ?? (() => { })} onDelete={onDeleteWeight ?? (() => { })} />}
                {dateKey && <WorkoutSummarySection date={dateKey} refreshKey={workoutRefreshKey} onQuickAdd={onQuickAdd} hideWhenEmpty />}
                <LogPhotosSection dateKey={dateKey} refreshKey={workoutRefreshKey} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    dayPage: {},
    content: { padding: spacing.md, paddingBottom: 160 },
});
