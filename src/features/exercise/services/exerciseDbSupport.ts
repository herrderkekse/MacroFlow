import { db } from "@/src/services/db";
import { exerciseSets, exerciseTemplates, workoutExercises, workouts } from "@/src/services/db/schema";
import { asc, desc, eq } from "drizzle-orm";

type ExerciseTemplate = typeof exerciseTemplates.$inferSelect;
type Workout = typeof workouts.$inferSelect;
type WorkoutExercise = typeof workoutExercises.$inferSelect;
type ExerciseSet = typeof exerciseSets.$inferSelect;

function getExerciseTemplateOrThrow(id: number): ExerciseTemplate {
    const template = db.select().from(exerciseTemplates).where(eq(exerciseTemplates.id, id)).get();
    if (!template) throw new Error(`Exercise template ${id} not found`);
    return template;
}

function getWorkoutOrThrow(id: number): Workout {
    const workout = db.select().from(workouts).where(eq(workouts.id, id)).get();
    if (!workout) throw new Error(`Workout ${id} not found`);
    return workout;
}

function getWorkoutExerciseOrThrow(id: number): WorkoutExercise {
    const workoutExercise = db.select().from(workoutExercises).where(eq(workoutExercises.id, id)).get();
    if (!workoutExercise) throw new Error(`Workout exercise ${id} not found`);
    return workoutExercise;
}

function getExerciseSetOrThrow(id: number): ExerciseSet {
    const set = db.select().from(exerciseSets).where(eq(exerciseSets.id, id)).get();
    if (!set) throw new Error(`Exercise set ${id} not found`);
    return set;
}

function getNextExerciseSortOrder(workoutId: number): number {
    const lastExercise = db
        .select({ sortOrder: workoutExercises.sort_order })
        .from(workoutExercises)
        .where(eq(workoutExercises.workout_id, workoutId))
        .orderBy(desc(workoutExercises.sort_order), desc(workoutExercises.id))
        .get();

    return (lastExercise?.sortOrder ?? 0) + 1;
}

function getNextSetOrder(workoutExerciseId: number): number {
    const lastSet = db
        .select({ setOrder: exerciseSets.set_order })
        .from(exerciseSets)
        .where(eq(exerciseSets.workout_exercise_id, workoutExerciseId))
        .orderBy(desc(exerciseSets.set_order), desc(exerciseSets.id))
        .get();

    return (lastSet?.setOrder ?? 0) + 1;
}

function listSetsForExercise(workoutExerciseId: number): ExerciseSet[] {
    return db
        .select()
        .from(exerciseSets)
        .where(eq(exerciseSets.workout_exercise_id, workoutExerciseId))
        .orderBy(asc(exerciseSets.set_order), asc(exerciseSets.id))
        .all();
}

function normalizeExerciseSortOrder(workoutId: number) {
    const orderedExercises = db
        .select()
        .from(workoutExercises)
        .where(eq(workoutExercises.workout_id, workoutId))
        .orderBy(asc(workoutExercises.sort_order), asc(workoutExercises.id))
        .all();

    orderedExercises.forEach((exercise, index) => {
        const nextOrder = index + 1;
        if (exercise.sort_order !== nextOrder) {
            db.update(workoutExercises).set({ sort_order: nextOrder }).where(eq(workoutExercises.id, exercise.id)).run();
        }
    });
}

function normalizeSetOrder(workoutExerciseId: number) {
    const orderedSets = listSetsForExercise(workoutExerciseId);

    orderedSets.forEach((set, index) => {
        const nextOrder = index + 1;
        if (set.set_order !== nextOrder) {
            db.update(exerciseSets).set({ set_order: nextOrder }).where(eq(exerciseSets.id, set.id)).run();
        }
    });
}

const exerciseDbSupport = {
    getExerciseTemplateOrThrow,
    getWorkoutOrThrow,
    getWorkoutExerciseOrThrow,
    getExerciseSetOrThrow,
    getNextExerciseSortOrder,
    getNextSetOrder,
    listSetsForExercise,
    normalizeExerciseSortOrder,
    normalizeSetOrder,
};

export default exerciseDbSupport;
