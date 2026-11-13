import type { TFunction } from "i18next";
import { parseCustomValues, type CustomValues } from "../helpers/customFields";
import type { ExerciseSet } from "../services/exerciseDb";
import type { ExerciseType } from "../types";

export const SET_TYPES = ["warmup", "working", "dropset", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

/** The prefix of a set's number ("W1", "D3"); a working set has none. */
export const SET_TYPE_LABELS: Record<SetType, string> = {
    warmup: "W", working: "", dropset: "D", failure: "F",
};

export interface Prefill {
    weight: number | null;
    reps: number | null;
    rir: number | null;
    duration: number | null;
    distance: number | null;
    custom: CustomValues;
}

/** Determine if a set is the "active" (first non-completed) set. */
export function isActiveSet(set: ExerciseSet, index: number, sets: ExerciseSet[]): boolean {
    if (!!set.completed_at) return false;
    const firstUncompletedIdx = sets.findIndex((s) => !s.completed_at);
    return firstUncompletedIdx === index;
}

/** Pre-fill logic: previous completed set in this exercise > last workout's matching set. */
export function getPrefillForSet(index: number, sets: ExerciseSet[], lastWorkoutSets: ExerciseSet[]): Prefill {
    // 1. Previous completed set in same exercise
    for (let i = index - 1; i >= 0; i--) {
        if (sets[i].completed_at) {
            return prefillFromSet(sets[i]);
        }
    }
    // 2. Matching set from last workout
    if (lastWorkoutSets.length > index) {
        return prefillFromSet(lastWorkoutSets[index]);
    }
    if (lastWorkoutSets.length > 0) {
        return prefillFromSet(lastWorkoutSets[lastWorkoutSets.length - 1]);
    }
    return { weight: null, reps: null, rir: null, duration: null, distance: null, custom: {} };
}

function prefillFromSet(s: ExerciseSet): Prefill {
    return {
        weight: s.weight, reps: s.reps, rir: s.rir,
        duration: s.duration_seconds, distance: s.distance_meters,
        custom: parseCustomValues(s.custom_values),
    };
}

/**
 * One line about an exercise's last session for the card's head: "Last: 4 × 8
 * @ 75 kg" (set count, then the heaviest set), or that there is none yet.
 */
export function lastSessionLine(lastSets: ExerciseSet[], exerciseType: ExerciseType, t: TFunction): string {
    if (lastSets.length === 0) return t("exercise.exerciseCard.noHistoryYet");
    const count = lastSets.length;
    const best = lastSets.reduce((a, b) => {
        const aScore = (a.weight ?? 0) * 1000 + (a.reps ?? 0);
        const bScore = (b.weight ?? 0) * 1000 + (b.reps ?? 0);
        return bScore > aScore ? b : a;
    });
    let summary: string;
    if (exerciseType === "weight" && best.weight != null && best.reps != null) {
        summary = `${count} × ${best.reps} @ ${best.weight} ${best.weight_unit ?? "kg"}`;
    } else if ((exerciseType === "weight" || exerciseType === "bodyweight") && best.reps != null) {
        summary = `${count} × ${best.reps}`;
    } else {
        summary = t("exercise.workoutSummary.setCount", { count });
    }
    return t("exercise.exerciseCard.last", { summary });
}
