import oneRepMax from "@/src/features/exercise/helpers/oneRepMax";
import exerciseDbSupport from "@/src/features/exercise/services/exerciseDbSupport";
import { db } from "@/src/services/db";
import { exerciseSets, exerciseTemplates, workoutExercises, workouts } from "@/src/services/db/schema";
import { formatDateKey, shiftCalendarDate } from "@/src/utils/date";
import { and, asc, desc, eq, gte, isNotNull, like, sql } from "drizzle-orm";

export type ExerciseTemplate = typeof exerciseTemplates.$inferSelect;
export type NewExerciseTemplate = typeof exerciseTemplates.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;
export type ExerciseSet = typeof exerciseSets.$inferSelect;
export type NewExerciseSet = typeof exerciseSets.$inferInsert;

export interface WorkoutExerciseWithSets {
    workout: Workout;
    workoutExercise: WorkoutExercise;
    exerciseTemplate: ExerciseTemplate | null;
    sets: ExerciseSet[];
}

export interface WorkoutWithExercises {
    workout: Workout;
    exercises: WorkoutExerciseWithSets[];
}

export interface Estimated1RMPoint {
    date: string;
    e1rm: number;
}

export interface WorkoutVolume {
    totalSets: number;
    totalReps: number;
    totalWeight: number;
}

export interface ExercisePersonalBest {
    weight: number;
    reps: number;
    e1rm: number;
}

const DEFAULT_RECENT_LIMIT = 10;

function listWorkoutExercisesForWorkout(workoutId: number): WorkoutExerciseWithSets[] {
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

function listWorkoutExerciseHistory(templateId: number, limit?: number): WorkoutExerciseWithSets[] {
    const rows = db
        .select()
        .from(workoutExercises)
        .innerJoin(workouts, eq(workoutExercises.workout_id, workouts.id))
        .leftJoin(exerciseTemplates, eq(workoutExercises.exercise_template_id, exerciseTemplates.id))
        .where(eq(workoutExercises.exercise_template_id, templateId))
        .orderBy(desc(workouts.date), desc(workouts.started_at), desc(workoutExercises.id))
        .limit(limit ?? DEFAULT_RECENT_LIMIT)
        .all();

    return rows.map((row) => ({
        workout: row.workouts,
        workoutExercise: row.workout_exercises,
        exerciseTemplate: row.exercise_templates,
        sets: exerciseDbSupport.listSetsForExercise(row.workout_exercises.id),
    }));
}

export function createExerciseTemplate(data: NewExerciseTemplate): ExerciseTemplate {
    const { created_at, deleted, ...rest } = data;
    return db
        .insert(exerciseTemplates)
        .values({
            ...rest,
            created_at: created_at ?? Date.now(),
            deleted: deleted ?? 0,
        })
        .returning()
        .get();
}

export function getExerciseTemplateById(id: number): ExerciseTemplate | undefined {
    return db.select().from(exerciseTemplates).where(eq(exerciseTemplates.id, id)).get();
}

export function searchExerciseTemplates(query: string): ExerciseTemplate[] {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) return [];

    return db
        .select()
        .from(exerciseTemplates)
        .where(and(like(exerciseTemplates.name, `%${trimmedQuery}%`), eq(exerciseTemplates.deleted, 0)))
        .orderBy(asc(exerciseTemplates.name))
        .limit(30)
        .all();
}

export function getExerciseTemplatesByMuscleGroup(group: string): ExerciseTemplate[] {
    return db
        .select()
        .from(exerciseTemplates)
        .where(and(eq(exerciseTemplates.muscle_group, group), eq(exerciseTemplates.deleted, 0)))
        .orderBy(asc(exerciseTemplates.name))
        .all();
}

export function getRecentExerciseTemplates(limit = DEFAULT_RECENT_LIMIT): ExerciseTemplate[] {
    const cutoffDate = formatDateKey(shiftCalendarDate(new Date(), -30));
    const rows = db
        .select({
            templateId: workoutExercises.exercise_template_id,
            usageCount: sql<number>`count(${workoutExercises.id})`,
            latestStartedAt: sql<number>`max(${workouts.started_at})`,
        })
        .from(workoutExercises)
        .innerJoin(workouts, eq(workoutExercises.workout_id, workouts.id))
        .innerJoin(exerciseTemplates, eq(workoutExercises.exercise_template_id, exerciseTemplates.id))
        .where(and(eq(exerciseTemplates.deleted, 0), gte(workouts.date, cutoffDate)))
        .groupBy(workoutExercises.exercise_template_id)
        .orderBy(desc(sql`count(${workoutExercises.id})`), desc(sql`max(${workouts.started_at})`))
        .limit(limit)
        .all();

    return rows.flatMap((row) => {
        const template = getExerciseTemplateById(row.templateId);
        return template ? [template] : [];
    });
}

export function updateExerciseTemplate(id: number, data: Partial<NewExerciseTemplate>) {
    exerciseDbSupport.getExerciseTemplateOrThrow(id);
    db.update(exerciseTemplates).set(data).where(eq(exerciseTemplates.id, id)).run();
}

export function softDeleteExerciseTemplate(id: number) {
    exerciseDbSupport.getExerciseTemplateOrThrow(id);
    db.update(exerciseTemplates).set({ deleted: 1 }).where(eq(exerciseTemplates.id, id)).run();
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

export function getRecentWorkouts(limit = DEFAULT_RECENT_LIMIT): Workout[] {
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
    exerciseDbSupport.normalizeExerciseSortOrder(workoutExercise.workout_id);
}

export function getExercisesForWorkout(workoutId: number): WorkoutExerciseWithSets[] {
    exerciseDbSupport.getWorkoutOrThrow(workoutId);
    return listWorkoutExercisesForWorkout(workoutId);
}

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

export function getSetsForExercise(workoutExerciseId: number): ExerciseSet[] {
    exerciseDbSupport.getWorkoutExerciseOrThrow(workoutExerciseId);
    return exerciseDbSupport.listSetsForExercise(workoutExerciseId);
}

export function getExerciseHistory(templateId: number, limit = DEFAULT_RECENT_LIMIT): WorkoutExerciseWithSets[] {
    exerciseDbSupport.getExerciseTemplateOrThrow(templateId);
    return listWorkoutExerciseHistory(templateId, limit);
}

export function getEstimated1RMSeries(templateId: number): Estimated1RMPoint[] {
    const template = exerciseDbSupport.getExerciseTemplateOrThrow(templateId);
    const rows = db
        .select({
            date: workouts.date,
            weight: exerciseSets.weight,
            weightUnit: exerciseSets.weight_unit,
            reps: exerciseSets.reps,
        })
        .from(exerciseSets)
        .innerJoin(workoutExercises, eq(exerciseSets.workout_exercise_id, workoutExercises.id))
        .innerJoin(workouts, eq(workoutExercises.workout_id, workouts.id))
        .where(and(eq(workoutExercises.exercise_template_id, templateId), isNotNull(exerciseSets.completed_at)))
        .orderBy(asc(workouts.date), asc(workoutExercises.id), asc(exerciseSets.set_order), asc(exerciseSets.id))
        .all();

    const bestByDate = new Map<string, number>();
    for (const row of rows) {
        if (row.weight === null || row.reps === null || row.reps <= 0) continue;

        const e1rm = oneRepMax.toEstimated1RM(oneRepMax.toKg(row.weight, row.weightUnit), row.reps);
        const currentBest = bestByDate.get(row.date) ?? null;
        if (oneRepMax.isBetterPerformance(e1rm, currentBest, template.resistance_mode)) {
            bestByDate.set(row.date, e1rm);
        }
    }

    return Array.from(bestByDate.entries()).map(([date, e1rm]) => ({ date, e1rm }));
}

export function getWorkoutVolume(workoutId: number): WorkoutVolume {
    exerciseDbSupport.getWorkoutOrThrow(workoutId);

    const rows = db
        .select({
            reps: exerciseSets.reps,
            weight: exerciseSets.weight,
            weightUnit: exerciseSets.weight_unit,
        })
        .from(exerciseSets)
        .innerJoin(workoutExercises, eq(exerciseSets.workout_exercise_id, workoutExercises.id))
        .where(and(eq(workoutExercises.workout_id, workoutId), isNotNull(exerciseSets.completed_at)))
        .all();

    return rows.reduce<WorkoutVolume>((volume, row) => {
        const reps = row.reps ?? 0;
        const weightKg = row.weight === null ? 0 : oneRepMax.toKg(row.weight, row.weightUnit);
        return {
            totalSets: volume.totalSets + 1,
            totalReps: volume.totalReps + reps,
            totalWeight: volume.totalWeight + weightKg * reps,
        };
    }, { totalSets: 0, totalReps: 0, totalWeight: 0 });
}

export function getExercisePersonalBest(templateId: number): ExercisePersonalBest | null {
    const template = exerciseDbSupport.getExerciseTemplateOrThrow(templateId);
    const rows = db
        .select({
            weight: exerciseSets.weight,
            weightUnit: exerciseSets.weight_unit,
            reps: exerciseSets.reps,
        })
        .from(exerciseSets)
        .innerJoin(workoutExercises, eq(exerciseSets.workout_exercise_id, workoutExercises.id))
        .where(and(eq(workoutExercises.exercise_template_id, templateId), isNotNull(exerciseSets.completed_at)))
        .orderBy(asc(exerciseSets.id))
        .all();

    let best: ExercisePersonalBest | null = null;
    for (const row of rows) {
        if (row.weight === null || row.reps === null || row.reps <= 0) continue;

        const weight = oneRepMax.toKg(row.weight, row.weightUnit);
        const e1rm = oneRepMax.toEstimated1RM(weight, row.reps);
        if (oneRepMax.isBetterPerformance(e1rm, best?.e1rm ?? null, template.resistance_mode)) {
            best = {
                weight,
                reps: row.reps,
                e1rm,
            };
        }
    }

    return best;
}
