// Barrel — re-exports from domain-focused modules for backward compatibility.
export {
    createExerciseTemplate,
    deleteExerciseTemplate,
    getAllExerciseTemplates,
    getExerciseTemplateById,
    getExerciseTemplatesByMuscleGroup,
    getRecentExerciseTemplates,
    searchExerciseTemplates,
    softDeleteExerciseTemplate,
    updateExerciseTemplate,
} from "./exerciseTemplateDb";
export type { ExerciseTemplate, NewExerciseTemplate } from "./exerciseTemplateDb";

export {
    addExerciseToWorkout,
    copyWorkoutAsScheduled,
    createWorkout,
    deleteWorkout,
    finishWorkout,
    getExercisesForWorkout,
    getRecentWorkouts,
    getUnfinishedWorkoutByDate,
    getWorkoutById,
    getWorkoutsByDate,
    hasUnfinishedScheduledSets,
    removeExerciseFromWorkout,
    reorderExercise,
    updateWorkout,
    updateWorkoutExercise,
} from "./workoutDb";
export type { NewWorkout, NewWorkoutExercise, Workout, WorkoutExercise, WorkoutExerciseWithSets, WorkoutWithExercises } from "./workoutDb";

export {
    addSet,
    completeSet,
    copySetsFromLastSession,
    copySetsFromWorkoutExercise,
    deleteSet,
    getLastCompletedSetsForTemplate,
    reorderSet,
    getSetsForExercise,
    updateSet,
} from "./exerciseSetDb";
export type { ExerciseSet, NewExerciseSet } from "./exerciseSetDb";

export {
    getEstimated1RMSeries,
    getExerciseHistory,
    getExercisePersonalBest,
    getWorkoutVolume,
} from "./exerciseStatsDb";
export type { Estimated1RMPoint, ExercisePersonalBest, WorkoutVolume } from "./exerciseStatsDb";
