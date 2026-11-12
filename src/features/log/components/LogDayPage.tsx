// eslint-disable-next-line boundaries/dependencies
import WorkoutSummarySection from "@/src/features/exercise/components/WorkoutSummarySection";
import type { CollapsibleFollowerProps, CollapsibleScrollProps } from "@/src/shared/hooks/useCollapsibleHeader";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import { screenPadding } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import type { EntryWithFood } from "../helpers/logHelpers";
import type { WeightLog } from "../services/logDb";
import LogPhotosSection from "./LogPhotosSection";
import type { RecipeGroup } from "./MealSection";
import MealSection from "./MealSection";
import WeightSection from "./WeightSection";

interface LogDayPageProps {
    width: number;
    grouped: Record<MealType, EntryWithFood[]>;
    /** The header's scroll wiring: the main props for today's page, follower props for its neighbours. */
    scroll: CollapsibleScrollProps | CollapsibleFollowerProps;
    /** Room reserved for the header above the content. */
    contentInset: ViewStyle;
    onAdd: (mt: MealType) => void;
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
    scroll,
    contentInset,
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
    weightLogs,
    onAddWeight,
    onDeleteWeight,
    dateKey,
    onQuickAdd,
    workoutRefreshKey,
}: LogDayPageProps) {
    const hasWeightLogs = (weightLogs?.length ?? 0) > 0;

    return (
        <View style={[styles.dayPage, { width }]}>
            <Animated.ScrollView
                {...scroll}
                contentContainerStyle={[styles.content, contentInset]}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
            >
                {MEAL_TYPES.map((meal) => (
                    <MealSection
                        key={meal.key}
                        mealType={meal.key}
                        icon={meal.icon}
                        items={grouped[meal.key]}
                        onAdd={() => onAdd(meal.key)}
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
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    dayPage: {},
    content: { paddingHorizontal: screenPadding, paddingBottom: 180 },
});
