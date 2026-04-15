import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import type { SetValues } from "../types";
import type { UseRestTimerReturn } from "./useRestTimer";
import type { UseWorkoutReturn } from "./useWorkout";
import {
    addSet, completeSet, copySetsFromLastSession, deleteSet,
    getLastCompletedSetsForTemplate, updateSet,
    updateWorkoutExercise, type ExerciseSet,
} from "../services/exerciseDb";

export function useWorkoutActions(workout: UseWorkoutReturn, restTimer: UseRestTimerReturn) {
    const { t } = useTranslation();

    const handleNoteChange = useCallback((workoutExerciseId: number, note: string) => {
        updateWorkoutExercise(workoutExerciseId, { notes: note || null });
        workout.reload();
    }, [workout]);

    const handleMoveUp = useCallback((workoutExerciseId: number) => {
        const exercises = workout.data?.exercises ?? [];
        const idx = exercises.findIndex((e) => e.workoutExercise.id === workoutExerciseId);
        if (idx > 0) workout.moveExercise(workoutExerciseId, idx);
    }, [workout]);

    const handleMoveDown = useCallback((workoutExerciseId: number) => {
        const exercises = workout.data?.exercises ?? [];
        const idx = exercises.findIndex((e) => e.workoutExercise.id === workoutExerciseId);
        if (idx < exercises.length - 1) workout.moveExercise(workoutExerciseId, idx + 2);
    }, [workout]);

    const handleConfirmSet = useCallback((setId: number, values: SetValues) => {
        updateSet(setId, {
            weight: values.weight,
            weight_unit: values.weight_unit,
            reps: values.reps,
            rir: values.rir,
            duration_seconds: values.duration_seconds,
            distance_meters: values.distance_meters,
            type: values.type,
        });
        completeSet(setId);

        for (const ex of workout.data?.exercises ?? []) {
            if (ex.sets.some((s) => s.id === setId)) {
                restTimer.start(ex.workoutExercise.id, values.type);
                break;
            }
        }
        workout.reload();
    }, [workout, restTimer]);

    const handleUpdateSet = useCallback((setId: number, values: SetValues) => {
        updateSet(setId, {
            weight: values.weight,
            weight_unit: values.weight_unit,
            reps: values.reps,
            rir: values.rir,
            duration_seconds: values.duration_seconds,
            distance_meters: values.distance_meters,
            type: values.type,
        });
    }, []);

    const handleDeleteSet = useCallback((setId: number) => {
        deleteSet(setId);
        workout.reload();
    }, [workout]);

    const handleSetTypeChange = useCallback((setId: number, type: string) => {
        updateSet(setId, { type });
        workout.reload();
    }, [workout]);

    const handleAddSet = useCallback((workoutExerciseId: number) => {
        const ex = workout.data?.exercises.find((e) => e.workoutExercise.id === workoutExerciseId);
        const defaultUnit = ex?.exerciseTemplate?.default_weight_unit ?? "kg";
        addSet({ workout_exercise_id: workoutExerciseId, weight_unit: defaultUnit });
        workout.reload();
    }, [workout]);

    const handleCopyFromLast = useCallback((workoutExerciseId: number, templateId: number) => {
        const count = copySetsFromLastSession(templateId, workoutExerciseId);
        if (count === 0) Alert.alert(t("exercise.exerciseCard.noHistory"));
        workout.reload();
    }, [workout, t]);

    const lastSetsCache = useMemo(() => {
        const cache = new Map<number, ExerciseSet[]>();
        for (const ex of workout.data?.exercises ?? []) {
            const tid = ex.workoutExercise.exercise_template_id;
            if (tid && !cache.has(tid)) {
                cache.set(tid, getLastCompletedSetsForTemplate(tid));
            }
        }
        return cache;
    }, [workout.data?.exercises]);

    return {
        handleNoteChange,
        handleMoveUp,
        handleMoveDown,
        handleConfirmSet,
        handleUpdateSet,
        handleDeleteSet,
        handleSetTypeChange,
        handleAddSet,
        handleCopyFromLast,
        lastSetsCache,
    };
}
