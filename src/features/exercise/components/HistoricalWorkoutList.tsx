import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import SectionHeader from "@/src/shared/components/SectionHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius } from "@/src/utils/theme";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { getMuscleGroupColor } from "../helpers/muscleGroupColor";
import {
    copyWorkoutAsScheduled,
    getExercisesForWorkout,
    getRecentWorkouts,
    type Workout,
} from "../services/exerciseDb";

interface HistoricalWorkoutListProps {
    excludeWorkoutId?: number;
    onCopied?: () => void;
    /**
     * The empty workout's placeholder, shown above the list. With no recent
     * workouts to show it centres in the free space instead, like any empty
     * list's placeholder.
     */
    emptyState?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

interface WorkoutRow {
    workout: Workout;
    exerciseCount: number;
    muscleGroups: string[];
}

/**
 * An empty workout's way to start from an old one: "• RECENT WORKOUTS" over
 * one card of rows; tapping a row copies its exercises in as scheduled sets.
 * Its heading has no `onAdd`, so it shows a dot rather than a "+".
 */
export default function HistoricalWorkoutList({ excludeWorkoutId, onCopied, emptyState, style }: HistoricalWorkoutListProps) {
    const colors = useThemeColors();
    const { t, i18n } = useTranslation();
    const [rows, setRows] = useState<WorkoutRow[]>([]);

    useEffect(() => {
        queueMicrotask(() => {
            const recents = getRecentWorkouts(20);
            const filtered = recents.filter(
                (w) => w.ended_at !== null && w.id !== excludeWorkoutId,
            );
            setRows(filtered.map((w) => {
                const exercises = getExercisesForWorkout(w.id);
                const muscleGroups = [...new Set(
                    exercises
                        .map((e) => e.exerciseTemplate?.muscle_group)
                        .filter((g): g is string => !!g),
                )];
                return {
                    workout: w,
                    exerciseCount: exercises.length,
                    muscleGroups,
                };
            }));
        });
    }, [excludeWorkoutId]);

    function handleCopy(sourceId: number) {
        if (excludeWorkoutId == null) return;
        copyWorkoutAsScheduled(sourceId, excludeWorkoutId);
        onCopied?.();
    }

    function formatDate(dateStr: string): string {
        const [y, m, d] = dateStr.split("-");
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        return dateObj.toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" });
    }

    // Nothing to start from: the placeholder alone, centred in the free space.
    if (rows.length === 0) {
        return <View style={[style, styles.centred]}>{emptyState}</View>;
    }

    return (
        <View style={style}>
            {emptyState}
            <SectionHeader
                title={t("exercise.copyWorkout.recentHeader")}
                hint={t("exercise.copyWorkout.recentHint")}
            />
            <ListGroup>
                {rows.map((item) => (
                    <ListRow
                        key={item.workout.id}
                        title={item.workout.title || t("exercise.workout.defaultTitle")}
                        subtitle={`${formatDate(item.workout.date)} · ${t("exercise.workoutSummary.exerciseCount", { count: item.exerciseCount })}`}
                        onPress={() => handleCopy(item.workout.id)}
                        showChevron={false}
                        right={
                            <View style={styles.dots}>
                                {item.muscleGroups.map((group) => (
                                    <View
                                        key={group}
                                        style={[styles.dot, { backgroundColor: getMuscleGroupColor(group, colors) }]}
                                    />
                                ))}
                            </View>
                        }
                    />
                ))}
            </ListGroup>
        </View>
    );
}

const styles = StyleSheet.create({
    centred: { justifyContent: "center" },
    dots: { flexDirection: "row", gap: 4 },
    dot: { width: 8, height: 8, borderRadius: borderRadius.full },
});
