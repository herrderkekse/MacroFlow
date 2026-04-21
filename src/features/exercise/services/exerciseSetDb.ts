import exerciseDbSupport from "@/src/features/exercise/services/exerciseDbSupport";
import { db } from "@/src/services/db";
import { exerciseSets, workoutExercises, workouts } from "@/src/services/db/schema";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";

export type ExerciseSet = typeof exerciseSets.$inferSelect;
export type NewExerciseSet = typeof exerciseSets.$inferInsert;

export function addSet(data: NewExerciseSet): ExerciseSet {
    const { set_order, ...rest } = data;
    exerciseDbSupport.getWorkoutExerciseOrThrow(data.workout_exercise_id);
    return db
        .insert(exerciseSets)
        .values({
            ...rest,
            set_order: set_order ?? exerciseDbSupport.getNextSetOrder(data.workout_exercise_id),
        })
        .returning()
        .get();
}

export function updateSet(id: number, data: Partial<NewExerciseSet>) {
    exerciseDbSupport.getExerciseSetOrThrow(id);
    db.update(exerciseSets).set(data).where(eq(exerciseSets.id, id)).run();
}

export function completeSet(id: number, completedAt = Date.now()) {
    exerciseDbSupport.getExerciseSetOrThrow(id);
    db.update(exerciseSets).set({ completed_at: completedAt, is_scheduled: 0 }).where(eq(exerciseSets.id, id)).run();
}

export function deleteSet(id: number) {
    const set = exerciseDbSupport.getExerciseSetOrThrow(id);
    db.delete(exerciseSets).where(eq(exerciseSets.id, id)).run();
    exerciseDbSupport.normalizeSetOrder(set.workout_exercise_id);
}

export function reorderSet(id: number, newOrder: number) {
    const targetSet = exerciseDbSupport.getExerciseSetOrThrow(id);
    const sets = db
        .select()
        .from(exerciseSets)
        .where(eq(exerciseSets.workout_exercise_id, targetSet.workout_exercise_id))
        .orderBy(asc(exerciseSets.set_order), asc(exerciseSets.id))
        .all();

    const sourceIndex = sets.findIndex((set) => set.id === id);
    if (sourceIndex === -1) throw new Error(`Exercise set ${id} not found`);

    const [setToMove] = sets.splice(sourceIndex, 1);
    const targetIndex = Math.max(0, Math.min(newOrder - 1, sets.length));
    sets.splice(targetIndex, 0, setToMove);

    sets.forEach((set, index) => {
        const setOrder = index + 1;
        if (set.set_order !== setOrder) {
            db.update(exerciseSets).set({ set_order: setOrder }).where(eq(exerciseSets.id, set.id)).run();
        }
    });
}

export function getSetsForExercise(workoutExerciseId: number): ExerciseSet[] {
    exerciseDbSupport.getWorkoutExerciseOrThrow(workoutExerciseId);
    return exerciseDbSupport.listSetsForExercise(workoutExerciseId);
}

/** Returns completed sets from the most recent finished workout that used this template. */
export function getLastCompletedSetsForTemplate(templateId: number): ExerciseSet[] {
    const rows = db
        .select({ weId: workoutExercises.id })
        .from(workoutExercises)
        .innerJoin(workouts, eq(workoutExercises.workout_id, workouts.id))
        .where(and(eq(workoutExercises.exercise_template_id, templateId), isNotNull(workouts.ended_at)))
        .orderBy(desc(workouts.date), desc(workoutExercises.id))
        .limit(1)
        .all();

    if (rows.length === 0) return [];
    return exerciseDbSupport.listSetsForExercise(rows[0].weId).filter((s) => !!s.completed_at);
}

/** Copies sets from a historical template instance into a target workout_exercise as scheduled. */
export function copySetsFromLastSession(templateId: number, targetWorkoutExerciseId: number): number {
    const sourceSets = getLastCompletedSetsForTemplate(templateId);
    if (sourceSets.length === 0) return 0;

    const existing = exerciseDbSupport.listSetsForExercise(targetWorkoutExerciseId);
    let order = existing.length + 1;

    for (const s of sourceSets) {
        db.insert(exerciseSets)
            .values({
                workout_exercise_id: targetWorkoutExerciseId,
                set_order: order++,
                type: s.type,
                weight: s.weight,
                weight_unit: s.weight_unit,
                reps: s.reps,
                duration_seconds: s.duration_seconds,
                distance_meters: s.distance_meters,
                rir: s.rir,
                rest_seconds: s.rest_seconds,
                is_scheduled: 1,
            })
            .run();
    }
    return sourceSets.length;
}

/** Copies completed sets from a specific workout exercise into a target as scheduled. */
export function copySetsFromWorkoutExercise(sourceWorkoutExerciseId: number, targetWorkoutExerciseId: number): number {
    const sourceSets = exerciseDbSupport.listSetsForExercise(sourceWorkoutExerciseId).filter((s) => !!s.completed_at);
    if (sourceSets.length === 0) return 0;

    const existing = exerciseDbSupport.listSetsForExercise(targetWorkoutExerciseId);
    let order = existing.length + 1;

    for (const s of sourceSets) {
        db.insert(exerciseSets)
            .values({
                workout_exercise_id: targetWorkoutExerciseId,
                set_order: order++,
                type: s.type,
                weight: s.weight,
                weight_unit: s.weight_unit,
                reps: s.reps,
                duration_seconds: s.duration_seconds,
                distance_meters: s.distance_meters,
                rir: s.rir,
                rest_seconds: s.rest_seconds,
                is_scheduled: 1,
            })
            .run();
    }
    return sourceSets.length;
}
