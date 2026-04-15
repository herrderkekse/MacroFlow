import {
    addExerciseToWorkout,
    createWorkout,
    finishWorkout,
    getExercisesForWorkout,
    getUnfinishedWorkoutByDate,
    getWorkoutById,
    hasUnfinishedScheduledSets,
    removeExerciseFromWorkout,
    reorderExercise,
    updateWorkout,
    type WorkoutWithExercises,
} from "@/src/features/exercise/services/exerciseDb";
import { formatDateKey } from "@/src/utils/date";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseWorkoutOptions {
    workoutId?: number;
    date?: Date;
}

export interface UseWorkoutReturn {
    data: WorkoutWithExercises | null;
    isResumed: boolean;
    elapsedMs: number;
    startWorkout: (date?: Date) => WorkoutWithExercises;
    finishCurrentWorkout: () => boolean;
    updateTitle: (title: string) => void;
    updateStartTime: (epoch: number) => void;
    updateEndTime: (epoch: number) => void;
    addExercise: (templateId: number) => void;
    removeExercise: (workoutExerciseId: number) => void;
    moveExercise: (workoutExerciseId: number, newOrder: number) => void;
    reload: () => void;
    hasUnfinishedSets: boolean;
}

export function useWorkout({ workoutId, date }: UseWorkoutOptions = {}): UseWorkoutReturn {
    const [data, setData] = useState<WorkoutWithExercises | null>(null);
    const [isResumed, setIsResumed] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadWorkout = useCallback((id: number) => {
        const result = getWorkoutById(id);
        setData(result ?? null);
        return result ?? null;
    }, []);

    const reload = useCallback(() => {
        if (data?.workout.id) loadWorkout(data.workout.id);
    }, [data?.workout.id, loadWorkout]);

    // Auto-load or auto-resume on mount
    useEffect(() => {
        if (workoutId) {
            loadWorkout(workoutId);
            setIsResumed(true);
            return;
        }

        const dateKey = formatDateKey(date ?? new Date());
        const unfinished = getUnfinishedWorkoutByDate(dateKey);
        if (unfinished) {
            setData(unfinished);
            setIsResumed(true);
        }
    }, [workoutId, date, loadWorkout]);

    // Elapsed time ticker
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);

        if (data?.workout && !data.workout.ended_at) {
            const tick = () => setElapsedMs(Date.now() - data.workout.started_at);
            tick();
            timerRef.current = setInterval(tick, 1000);
        } else {
            setElapsedMs(
                data?.workout.ended_at && data?.workout.started_at
                    ? data.workout.ended_at - data.workout.started_at
                    : 0,
            );
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [data?.workout?.id, data?.workout?.started_at, data?.workout?.ended_at]);

    const startWorkout = useCallback((startDate?: Date) => {
        const dateKey = formatDateKey(startDate ?? new Date());
        const workout = createWorkout({ date: dateKey, started_at: Date.now() });
        const result: WorkoutWithExercises = { workout, exercises: [] };
        setData(result);
        setIsResumed(false);
        return result;
    }, []);

    const finishCurrentWorkout = useCallback(() => {
        if (!data?.workout) return false;
        finishWorkout(data.workout.id);
        loadWorkout(data.workout.id);
        return true;
    }, [data?.workout, loadWorkout]);

    const updateTitle = useCallback(
        (title: string) => {
            if (!data?.workout) return;
            updateWorkout(data.workout.id, { title });
            setData((prev) =>
                prev ? { ...prev, workout: { ...prev.workout, title } } : null,
            );
        },
        [data?.workout],
    );

    const updateStartTime = useCallback(
        (epoch: number) => {
            if (!data?.workout) return;
            updateWorkout(data.workout.id, { started_at: epoch });
            setData((prev) =>
                prev ? { ...prev, workout: { ...prev.workout, started_at: epoch } } : null,
            );
        },
        [data?.workout],
    );

    const updateEndTime = useCallback(
        (epoch: number) => {
            if (!data?.workout) return;
            updateWorkout(data.workout.id, { ended_at: epoch });
            setData((prev) =>
                prev ? { ...prev, workout: { ...prev.workout, ended_at: epoch } } : null,
            );
        },
        [data?.workout],
    );

    const addExercise = useCallback(
        (templateId: number) => {
            if (!data?.workout) return;
            addExerciseToWorkout({
                workout_id: data.workout.id,
                exercise_template_id: templateId,
                sort_order: data.exercises.length + 1,
            });
            const exercises = getExercisesForWorkout(data.workout.id);
            setData((prev) => (prev ? { ...prev, exercises } : null));
        },
        [data?.workout, data?.exercises.length],
    );

    const removeExercise = useCallback(
        (workoutExerciseId: number) => {
            if (!data?.workout) return;
            removeExerciseFromWorkout(workoutExerciseId);
            const exercises = getExercisesForWorkout(data.workout.id);
            setData((prev) => (prev ? { ...prev, exercises } : null));
        },
        [data?.workout],
    );

    const moveExercise = useCallback(
        (workoutExerciseId: number, newOrder: number) => {
            if (!data?.workout) return;
            reorderExercise(workoutExerciseId, newOrder);
            const exercises = getExercisesForWorkout(data.workout.id);
            setData((prev) => (prev ? { ...prev, exercises } : null));
        },
        [data?.workout],
    );

    const hasUnfinishedSets = data?.workout
        ? hasUnfinishedScheduledSets(data.workout.id)
        : false;

    return {
        data,
        isResumed,
        elapsedMs,
        startWorkout,
        finishCurrentWorkout,
        updateTitle,
        updateStartTime,
        updateEndTime,
        addExercise,
        removeExercise,
        moveExercise,
        reload,
        hasUnfinishedSets,
    };
}
