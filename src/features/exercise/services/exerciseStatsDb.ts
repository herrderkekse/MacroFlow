import oneRepMax from "@/src/features/exercise/helpers/oneRepMax";
import exerciseDbSupport from "@/src/features/exercise/services/exerciseDbSupport";
import { db } from "@/src/services/db";
import { exerciseSets, exerciseTemplates, workoutExercises, workouts } from "@/src/services/db/schema";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";

import type { WorkoutExerciseWithSets } from "./workoutDb";

/** A day's best set, by estimated one-rep maximum. Weights are in kilograms. */
export interface Estimated1RMPoint {
    date: string;
    e1rm: number;
    /** The set the estimate comes from. */
    weightKg: number;
    reps: number;
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

    const bestByDate = new Map<string, Estimated1RMPoint>();
    for (const row of rows) {
        if (row.weight === null || row.reps === null || row.reps <= 0) continue;

        const weightKg = oneRepMax.toKg(row.weight, row.weightUnit);
        const e1rm = oneRepMax.toEstimated1RM(weightKg, row.reps);
        const currentBest = bestByDate.get(row.date)?.e1rm ?? null;
        if (oneRepMax.isBetterPerformance(e1rm, currentBest, template.resistance_mode)) {
            bestByDate.set(row.date, { date: row.date, e1rm, weightKg, reps: row.reps });
        }
    }

    return Array.from(bestByDate.values());
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
