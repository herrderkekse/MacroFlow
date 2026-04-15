// ── Primitive types ──────────────────────────────────────────────────────────

export type ExerciseType = "weight" | "cardio" | "bodyweight" | "other";
export type MuscleGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full_body";
export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "band" | "other";
export type ResistanceMode = "resistance" | "assistance";
export type SetType = "warmup" | "working" | "dropset" | "failure";
export type WeightUnit = "kg" | "lb";

// ── Set input values (shared between components and hooks) ──────────────────

export interface SetValues {
    weight: number | null;
    weight_unit: string;
    reps: number | null;
    rir: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
    type: string;
}
