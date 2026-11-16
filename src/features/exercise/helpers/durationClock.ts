// Which value of a set a stopwatch or timer fills in (issue #421), and how a
// clock reading is written into it.

import type { WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { parseCustomFields, type CustomField } from "./customFields";

/** A cardio set's own duration column, or one of an "other" exercise's custom fields. */
export type DurationTarget =
    | { kind: "duration" }
    | { kind: "custom"; fieldId: string; secondsPerUnit: number };

// Custom field units read as a time, lower-cased and without a trailing dot.
const SECONDS_PER_UNIT: Record<string, number> = {
    s: 1, sec: 1, secs: 1, second: 1, seconds: 1, sek: 1, sekunde: 1, sekunden: 1,
    min: 60, mins: 60, minute: 60, minutes: 60, minuten: 60,
    h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, std: 3600, stunde: 3600, stunden: 3600,
};

/** How many seconds one of `unit` is, or null when the unit is not a time. */
export function secondsPerUnit(unit: string): number | null {
    const key = unit.trim().toLowerCase().replace(/\.$/, "");
    return SECONDS_PER_UNIT[key] ?? null;
}

/**
 * The value a clock fills in for this exercise, or null when it tracks no
 * duration (and its card gets no watch).
 */
export function durationTargetFor(exerciseType: ExerciseType, customFields: CustomField[]): DurationTarget | null {
    if (exerciseType === "cardio") return { kind: "duration" };
    if (exerciseType !== "other") return null;
    for (const field of customFields) {
        const perUnit = secondsPerUnit(field.unit);
        if (perUnit !== null) return { kind: "custom", fieldId: field.id, secondsPerUnit: perUnit };
    }
    return null;
}

/** A clock reading in the target's unit: whole seconds, or a custom unit to one decimal. */
export function clockToFieldValue(seconds: number, target: DurationTarget): number {
    if (target.kind === "duration") return Math.max(0, Math.floor(seconds));
    return Math.max(0, Math.round((seconds / target.secondsPerUnit) * 10) / 10);
}

/** The duration target of an exercise in a workout, from its template. */
export function durationTargetOfExercise(exercise: WorkoutExerciseWithSets): DurationTarget | null {
    const template = exercise.exerciseTemplate;
    return durationTargetFor((template?.type as ExerciseType) ?? "weight", parseCustomFields(template?.custom_fields));
}
