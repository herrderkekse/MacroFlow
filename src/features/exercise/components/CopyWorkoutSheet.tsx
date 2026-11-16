import EmptyState from "@/src/shared/atoms/EmptyState";
import ListRow from "@/src/shared/components/ListRow";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius } from "@/src/utils/theme";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import {
    copyWorkoutAsScheduled,
    getExercisesForWorkout,
    getRecentWorkouts,
    type Workout,
} from "../services/exerciseDb";
import { getMuscleGroupColor } from "../helpers/muscleGroupColor";

interface CopyWorkoutSheetProps {
    visible: boolean;
    targetWorkoutId: number;
    onClose: () => void;
    onCopied: () => void;
}

interface WorkoutRow {
    workout: Workout;
    exerciseCount: number;
    muscleGroups: string[];
}

export default function CopyWorkoutSheet({ visible, targetWorkoutId, onClose, onCopied }: CopyWorkoutSheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const [rows, setRows] = useState<WorkoutRow[]>([]);

    useEffect(() => {
        if (!visible) return;
        queueMicrotask(() => {
            const recents = getRecentWorkouts(20);
            const filtered = recents.filter((w) => w.id !== targetWorkoutId && w.ended_at !== null);
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
    }, [visible, targetWorkoutId]);

    function handleCopy(sourceId: number) {
        copyWorkoutAsScheduled(sourceId, targetWorkoutId);
        onCopied();
        onClose();
    }

    function formatDate(dateStr: string): string {
        const [y, m, d] = dateStr.split("-");
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        return dateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t("exercise.copyWorkout.title")}
            subtitle={rows.length > 0 ? t("exercise.copyWorkout.subtitle") : undefined}
            padded={false}
        >
            {rows.length === 0 ? (
                <EmptyState icon="barbell-outline" title={t("exercise.copyWorkout.noWorkouts")} />
            ) : (
                rows.map((item) => (
                    <ListRow
                        key={item.workout.id}
                        title={item.workout.title || t("exercise.workout.defaultTitle")}
                        subtitle={formatDate(item.workout.date)}
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
                ))
            )}
        </Sheet>
    );
}

const styles = StyleSheet.create({
    dots: { flexDirection: "row", gap: 4 },
    dot: { width: 8, height: 8, borderRadius: borderRadius.full },
});
