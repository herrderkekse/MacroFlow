import type { Workout } from "@/src/features/exercise/services/workoutDb";
import EmptyState from "@/src/shared/atoms/EmptyState";
import ListRow from "@/src/shared/components/ListRow";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";

interface WorkoutPickerSheetProps {
    visible: boolean;
    workouts: Workout[];
    selectedWorkoutId: number | null;
    onSelectWorkout: (workoutId: number | null) => void;
    onClose: () => void;
}

/** Picks the workout a progress photo was taken after — or none. */
export default function WorkoutPickerSheet({
    visible,
    workouts,
    selectedWorkoutId,
    onSelectWorkout,
    onClose,
}: WorkoutPickerSheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const check = <Ionicons name="checkmark" size={20} color={colors.text} />;

    return (
        <Sheet visible={visible} onClose={onClose} title={t("log.photoDetailsWorkoutPickerTitle")} padded={false}>
            <ListRow
                title={t("log.photoDetailsNoWorkout")}
                onPress={() => onSelectWorkout(null)}
                right={selectedWorkoutId === null ? check : undefined}
                showChevron={false}
            />
            {workouts.length === 0 ? (
                <EmptyState title={t("log.photoDetailsNoRecentWorkouts")} />
            ) : (
                workouts.map((workout) => (
                    <ListRow
                        key={workout.id}
                        title={workout.title?.trim() ? workout.title : t("log.photoDetailsUntitledWorkout")}
                        subtitle={workout.date}
                        onPress={() => onSelectWorkout(workout.id)}
                        right={selectedWorkoutId === workout.id ? check : undefined}
                        showChevron={false}
                    />
                ))
            )}
        </Sheet>
    );
}
