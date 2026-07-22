import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { serializeCustomValues } from "../helpers/customFields";
import type { SetValues } from "../types";
import type { UseRestTimerReturn } from "./useRestTimer";
import type { UseWorkoutReturn } from "./useWorkout";
import {
    addSet, completeSet, copySetsFromLastSession, deleteSet,
    getLastCompletedSetsForTemplate, updateSet, reorderSet,
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
            custom_values: serializeCustomValues(values.custom_values),
            type: values.type,
        });
        completeSet(setId);

        const exercises = workout.data?.exercises ?? [];
        const owner = exercises.find((ex) => ex.sets.some((s) => s.id === setId));
        if (owner) {
            // In a superset only the first (base) exercise drives the rest timer, so
            // finishing the second exercise's set never resets it. `exercises` is
            // sort-ordered, so the first member found with this group is the base.
            const group = owner.workoutExercise.superset_group;
            const isBase = group == null
                || exercises.find((ex) => ex.workoutExercise.superset_group === group)?.workoutExercise.id
                    === owner.workoutExercise.id;
            if (isBase) restTimer.start(owner.workoutExercise.id, values.type);
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
            custom_values: serializeCustomValues(values.custom_values),
            type: values.type,
        });
        workout.reload();
    }, [workout]);

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
        const hasUnconfirmedScheduledSets = ex?.sets.some((s) => !!s.is_scheduled && !s.completed_at) ?? false;
        addSet({ workout_exercise_id: workoutExerciseId, weight_unit: defaultUnit, is_scheduled: hasUnconfirmedScheduledSets ? 1 : 0 });
        workout.reload();
    }, [workout]);

    const handleCopyFromLast = useCallback((workoutExerciseId: number, templateId: number) => {
        const count = copySetsFromLastSession(templateId, workoutExerciseId);
        if (count === 0) Alert.alert(t("exercise.exerciseCard.noHistory"));
        workout.reload();
    }, [workout, t]);

    const handleReorderSets = useCallback((workoutExerciseId: number, from: number, to: number) => {
        if (from === to) return;
        const ex = workout.data?.exercises.find((e) => e.workoutExercise.id === workoutExerciseId);
        if (!ex) return;
        const movedSet = ex.sets[from];
        if (!movedSet) return;
        reorderSet(movedSet.id, to + 1);
        workout.reload();
    }, [workout]);

    // Superset rows span two exercises, so reorder by set id and target position.
    const handleReorderSupersetSet = useCallback((setId: number, toIndex: number) => {
        reorderSet(setId, toIndex + 1);
        workout.reload();
    }, [workout]);

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
        handleReorderSets,
        handleReorderSupersetSet,
        lastSetsCache,
    };
}
