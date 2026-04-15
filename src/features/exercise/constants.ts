import type { Equipment, ExerciseType, MuscleGroup, SetType } from "@/src/features/exercise/types";

export const EXERCISE_TYPES: { key: ExerciseType; icon: string }[] = [
    { key: "weight", icon: "barbell-outline" },
    { key: "cardio", icon: "bicycle-outline" },
    { key: "bodyweight", icon: "body-outline" },
    { key: "other", icon: "ellipsis-horizontal-outline" },
];

export const MUSCLE_GROUPS: { key: MuscleGroup; icon: string; labelKey: string }[] = [
    { key: "chest", icon: "body-outline", labelKey: "exercise.muscles.chest" },
    { key: "back", icon: "body-outline", labelKey: "exercise.muscles.back" },
    { key: "legs", icon: "body-outline", labelKey: "exercise.muscles.legs" },
    { key: "shoulders", icon: "body-outline", labelKey: "exercise.muscles.shoulders" },
    { key: "arms", icon: "body-outline", labelKey: "exercise.muscles.arms" },
    { key: "core", icon: "body-outline", labelKey: "exercise.muscles.core" },
    { key: "full_body", icon: "body-outline", labelKey: "exercise.muscles.fullBody" },
];

export const EQUIPMENT_LIST: { key: Equipment; icon: string }[] = [
    { key: "barbell", icon: "barbell-outline" },
    { key: "dumbbell", icon: "barbell-outline" },
    { key: "machine", icon: "construct-outline" },
    { key: "cable", icon: "git-branch-outline" },
    { key: "bodyweight", icon: "body-outline" },
    { key: "band", icon: "ellipse-outline" },
    { key: "other", icon: "ellipsis-horizontal-outline" },
];

export const SET_TYPES: { key: SetType; labelKey: string }[] = [
    { key: "warmup", labelKey: "exercise.exerciseCard.warmup" },
    { key: "working", labelKey: "exercise.exerciseCard.working" },
    { key: "dropset", labelKey: "exercise.exerciseCard.dropset" },
    { key: "failure", labelKey: "exercise.exerciseCard.failure" },
];
