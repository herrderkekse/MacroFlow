import exerciseDbSupport from "@/src/features/exercise/services/exerciseDbSupport";
import { db } from "@/src/services/db";
import { exerciseSets, exerciseTemplates, workoutExercises, workouts } from "@/src/services/db/schema";
import { and, asc, desc, eq, gt, gte, lte, sql } from "drizzle-orm";

import type { ExerciseTemplate } from "./exerciseTemplateDb";

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;

export interface WorkoutExerciseWithSets {
    workout: Workout;
    workoutExercise: WorkoutExercise;
    exerciseTemplate: ExerciseTemplate | null;
    sets: (typeof exerciseSets.$inferSelect)[];
}

export interface WorkoutWithExercises {
    workout: Workout;
    exercises: WorkoutExerciseWithSets[];
}

export function listWorkoutExercisesForWorkout(workoutId: number): WorkoutExerciseWithSets[] {
    const rows = db
        .select()
        .from(workoutExercises)
        .innerJoin(workouts, eq(workoutExercises.workout_id, workouts.id))
        .leftJoin(exerciseTemplates, eq(workoutExercises.exercise_template_id, exerciseTemplates.id))
        .where(eq(workoutExercises.workout_id, workoutId))
        .orderBy(asc(workoutExercises.sort_order), asc(workoutExercises.id))
        .all();

    return rows.map((row) => ({
        workout: row.workouts,
        workoutExercise: row.workout_exercises,
        exerciseTemplate: row.exercise_templates,
        sets: exerciseDbSupport.listSetsForExercise(row.workout_exercises.id),
    }));
}

export function createWorkout(data: NewWorkout): Workout {
    const { started_at, ...rest } = data;
    return db
        .insert(workouts)
        .values({
            ...rest,
            started_at: started_at ?? Date.now(),
        })
        .returning()
        .get();
}

export function getWorkoutById(id: number): WorkoutWithExercises | undefined {
    const workout = db.select().from(workouts).where(eq(workouts.id, id)).get();
    if (!workout) return undefined;

    return {
        workout,
        exercises: listWorkoutExercisesForWorkout(id),
    };
}

export function getWorkoutsByDate(date: string): Workout[] {
    return db
        .select()
        .from(workouts)
        .where(eq(workouts.date, date))
        .orderBy(desc(workouts.started_at), desc(workouts.id))
        .all();
}

export function getWorkoutMuscleGroupsByDateRange(startDate: string, endDate: string): Record<string, string[]> {
    const rows = db
        .select({
            date: workouts.date,
            muscleGroup: exerciseTemplates.muscle_group,
        })
        .from(workouts)
        .innerJoin(workoutExercises, eq(workouts.id, workoutExercises.workout_id))
        .innerJoin(exerciseTemplates, eq(workoutExercises.exercise_template_id, exerciseTemplates.id))
        .where(
            and(
                gte(workouts.date, startDate),
                lte(workouts.date, endDate),
                eq(exerciseTemplates.deleted, 0),
                sql`${exerciseTemplates.muscle_group} IS NOT NULL`,
            ),
        )
        .all();

    const byDate = new Map<string, Set<string>>();
    for (const row of rows) {
        if (!row.muscleGroup) continue;
        const dayGroups = byDate.get(row.date) ?? new Set<string>();
        dayGroups.add(row.muscleGroup);
        byDate.set(row.date, dayGroups);
    }

    return Object.fromEntries(
        Array.from(byDate.entries()).map(([date, groups]) => [date, Array.from(groups)]),
    );
}

export function getUnfinishedWorkoutByDate(date: string): WorkoutWithExercises | undefined {
    const workout = db
        .select()
        .from(workouts)
        .where(and(eq(workouts.date, date), sql`${workouts.ended_at} IS NULL`))
        .orderBy(desc(workouts.started_at))
        .get();

    if (!workout) return undefined;
    return { workout, exercises: listWorkoutExercisesForWorkout(workout.id) };
}

export function hasUnfinishedScheduledSets(workoutId: number): boolean {
    const row = db
        .select({ count: sql<number>`count(*)` })
        .from(exerciseSets)
        .innerJoin(workoutExercises, eq(exerciseSets.workout_exercise_id, workoutExercises.id))
        .where(
            and(
                eq(workoutExercises.workout_id, workoutId),
                eq(exerciseSets.is_scheduled, 1),
                sql`${exerciseSets.completed_at} IS NULL`,
            ),
        )
        .get();
    return (row?.count ?? 0) > 0;
}

export function getRecentWorkouts(limit = 10): Workout[] {
    return db
        .select()
        .from(workouts)
        .orderBy(desc(workouts.date), desc(workouts.started_at), desc(workouts.id))
        .limit(limit)
        .all();
}

export function finishWorkout(id: number, endedAt = Date.now()) {
    exerciseDbSupport.getWorkoutOrThrow(id);
    db.update(workouts).set({ ended_at: endedAt }).where(eq(workouts.id, id)).run();
}

export function updateWorkout(id: number, data: Partial<NewWorkout>) {
    exerciseDbSupport.getWorkoutOrThrow(id);
    db.update(workouts).set(data).where(eq(workouts.id, id)).run();
}

export function deleteWorkout(id: number) {
    exerciseDbSupport.getWorkoutOrThrow(id);

    const exercises = db.select().from(workoutExercises).where(eq(workoutExercises.workout_id, id)).all();
    for (const exercise of exercises) {
        db.delete(exerciseSets).where(eq(exerciseSets.workout_exercise_id, exercise.id)).run();
    }

    db.delete(workoutExercises).where(eq(workoutExercises.workout_id, id)).run();
    db.delete(workouts).where(eq(workouts.id, id)).run();
}

export function addExerciseToWorkout(data: NewWorkoutExercise): WorkoutExercise {
    const { sort_order, started_at, ...rest } = data;
    exerciseDbSupport.getWorkoutOrThrow(data.workout_id);
    exerciseDbSupport.getExerciseTemplateOrThrow(data.exercise_template_id);
    return db
        .insert(workoutExercises)
        .values({
            ...rest,
            sort_order: sort_order ?? exerciseDbSupport.getNextExerciseSortOrder(data.workout_id),
            started_at: started_at ?? Date.now(),
        })
        .returning()
        .get();
}

/** A fresh opaque token that identifies a superset group. Shared by its members. */
function newSupersetGroup(): string {
    return `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Groups `baseWorkoutExerciseId` into a superset with a new exercise created from
 * `secondTemplateId` — the same person alternating between two exercises. The
 * second exercise is inserted directly after the base so the two stay adjacent,
 * and both share an opaque `superset_group` token. Returns the new exercise.
 */
export function supersetExercises(baseWorkoutExerciseId: number, secondTemplateId: number): WorkoutExercise {
    const base = exerciseDbSupport.getWorkoutExerciseOrThrow(baseWorkoutExerciseId);
    exerciseDbSupport.getExerciseTemplateOrThrow(secondTemplateId);

    const group = base.superset_group ?? newSupersetGroup();
    if (base.superset_group == null) {
        db.update(workoutExercises).set({ superset_group: group }).where(eq(workoutExercises.id, base.id)).run();
    }

    // Shift everything after the base down one slot so the second exercise sits adjacent.
    db.update(workoutExercises)
        .set({ sort_order: sql`${workoutExercises.sort_order} + 1` })
        .where(and(eq(workoutExercises.workout_id, base.workout_id), gt(workoutExercises.sort_order, base.sort_order)))
        .run();

    const secondExercise = db
        .insert(workoutExercises)
        .values({
            workout_id: base.workout_id,
            exercise_template_id: secondTemplateId,
            sort_order: base.sort_order + 1,
            superset_group: group,
            started_at: Date.now(),
        })
        .returning()
        .get();

    exerciseDbSupport.normalizeExerciseSortOrder(base.workout_id);
    return secondExercise;
}

/** After a member leaves a superset, clear the group flag if only one member is left. */
function dissolveOrphanSuperset(workoutId: number, group: string) {
    const members = db
        .select()
        .from(workoutExercises)
        .where(and(eq(workoutExercises.workout_id, workoutId), eq(workoutExercises.superset_group, group)))
        .all();
    if (members.length <= 1) {
        for (const member of members) {
            db.update(workoutExercises).set({ superset_group: null }).where(eq(workoutExercises.id, member.id)).run();
        }
    }
}

/** Persists a full top-to-bottom ordering of a workout's exercises (superset members flattened in place). */
export function reorderExerciseGroups(workoutId: number, orderedIds: number[]) {
    exerciseDbSupport.getWorkoutOrThrow(workoutId);
    orderedIds.forEach((id, index) => {
        db.update(workoutExercises)
            .set({ sort_order: index + 1 })
            .where(and(eq(workoutExercises.id, id), eq(workoutExercises.workout_id, workoutId)))
            .run();
    });
}

export function reorderExercise(id: number, newOrder: number) {
    const targetExercise = exerciseDbSupport.getWorkoutExerciseOrThrow(id);
    const exercises = db
        .select()
        .from(workoutExercises)
        .where(eq(workoutExercises.workout_id, targetExercise.workout_id))
        .orderBy(asc(workoutExercises.sort_order), asc(workoutExercises.id))
        .all();

    const sourceIndex = exercises.findIndex((exercise) => exercise.id === id);
    if (sourceIndex === -1) throw new Error(`Workout exercise ${id} not found`);

    const [exerciseToMove] = exercises.splice(sourceIndex, 1);
    const targetIndex = Math.max(0, Math.min(newOrder - 1, exercises.length));
    exercises.splice(targetIndex, 0, exerciseToMove);

    exercises.forEach((exercise, index) => {
        const sortOrder = index + 1;
        if (exercise.sort_order !== sortOrder) {
            db.update(workoutExercises).set({ sort_order: sortOrder }).where(eq(workoutExercises.id, exercise.id)).run();
        }
    });
}

export function removeExerciseFromWorkout(id: number) {
    const workoutExercise = exerciseDbSupport.getWorkoutExerciseOrThrow(id);
    db.delete(exerciseSets).where(eq(exerciseSets.workout_exercise_id, id)).run();
    db.delete(workoutExercises).where(eq(workoutExercises.id, id)).run();
    if (workoutExercise.superset_group != null) {
        dissolveOrphanSuperset(workoutExercise.workout_id, workoutExercise.superset_group);
    }
    exerciseDbSupport.normalizeExerciseSortOrder(workoutExercise.workout_id);
}

export function updateWorkoutExercise(id: number, data: Partial<NewWorkoutExercise>) {
    exerciseDbSupport.getWorkoutExerciseOrThrow(id);
    db.update(workoutExercises).set(data).where(eq(workoutExercises.id, id)).run();
}

export function getExercisesForWorkout(workoutId: number): WorkoutExerciseWithSets[] {
    exerciseDbSupport.getWorkoutOrThrow(workoutId);
    return listWorkoutExercisesForWorkout(workoutId);
}

export function copyWorkoutAsScheduled(sourceWorkoutId: number, targetWorkoutId: number): void {
    const sourceExercises = listWorkoutExercisesForWorkout(sourceWorkoutId);
    const sourceWorkout = exerciseDbSupport.getWorkoutOrThrow(sourceWorkoutId);
    exerciseDbSupport.getWorkoutOrThrow(targetWorkoutId);

    if (sourceWorkout.title) {
        db.update(workouts).set({ title: sourceWorkout.title }).where(eq(workouts.id, targetWorkoutId)).run();
    }

    // Remaps each source superset group to a fresh token for the copied members.
    const groupMap = new Map<string, string>();

    for (const ex of sourceExercises) {
        const newWe = db
            .insert(workoutExercises)
            .values({
                workout_id: targetWorkoutId,
                exercise_template_id: ex.workoutExercise.exercise_template_id,
                sort_order: ex.workoutExercise.sort_order,
                notes: ex.workoutExercise.notes,
            })
            .returning()
            .get();

        const srcGroup = ex.workoutExercise.superset_group;
        if (srcGroup != null) {
            let newGroup = groupMap.get(srcGroup);
            if (newGroup == null) {
                newGroup = newSupersetGroup();
                groupMap.set(srcGroup, newGroup);
            }
            db.update(workoutExercises).set({ superset_group: newGroup }).where(eq(workoutExercises.id, newWe.id)).run();
        }

        for (const set of ex.sets) {
            db.insert(exerciseSets)
                .values({
                    workout_exercise_id: newWe.id,
                    set_order: set.set_order,
                    type: set.type,
                    weight: set.weight,
                    weight_unit: set.weight_unit,
                    reps: set.reps,
                    duration_seconds: set.duration_seconds,
                    distance_meters: set.distance_meters,
                    rir: set.rir,
                    rest_seconds: set.rest_seconds,
                    is_scheduled: 1,
                })
                .run();
        }
    }
}
