import type { TFunction } from "i18next";
import type { Workout, WorkoutExerciseWithSets } from "../services/exerciseDb";

/** Sets done and sets in total, across every exercise of a workout. */
export function countSets(exercises: WorkoutExerciseWithSets[]): { done: number; total: number } {
    let done = 0;
    let total = 0;
    for (const ex of exercises) {
        total += ex.sets.length;
        done += ex.sets.filter((s) => !!s.completed_at).length;
    }
    return { done, total };
}

function formatDuration(ms: number, t: TFunction): string {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    if (totalMin < 60) return t("exercise.workoutSummary.duration", { minutes: totalMin });
    return t("exercise.workout.durationHours", { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 });
}

/**
 * The line under a workout's title: "In progress · 24 min · 3 exercises", or
 * "Finished 19:20 · 46 min · 3 exercises".
 */
export function workoutSubtitle(
    workout: Workout,
    elapsedMs: number,
    exerciseCount: number,
    t: TFunction,
    language: string,
): string {
    const state = workout.ended_at
        ? t("exercise.workout.finishedAt", {
            time: new Date(workout.ended_at).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" }),
        })
        : t("exercise.workout.inProgress");
    return [
        state,
        formatDuration(elapsedMs, t),
        t("exercise.workoutSummary.exerciseCount", { count: exerciseCount }),
    ].join(" · ");
}
