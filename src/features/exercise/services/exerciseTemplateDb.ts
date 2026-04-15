import exerciseDbSupport from "@/src/features/exercise/services/exerciseDbSupport";
import { db } from "@/src/services/db";
import { exerciseTemplates, workoutExercises, workouts } from "@/src/services/db/schema";
import { formatDateKey, shiftCalendarDate } from "@/src/utils/date";
import { and, asc, desc, eq, gte, like, sql } from "drizzle-orm";

export type ExerciseTemplate = typeof exerciseTemplates.$inferSelect;
export type NewExerciseTemplate = typeof exerciseTemplates.$inferInsert;

const DEFAULT_RECENT_LIMIT = 10;

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
