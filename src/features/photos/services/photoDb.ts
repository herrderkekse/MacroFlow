import { db } from "@/src/services/db";
import { progressPhotos, workouts } from "@/src/services/db/schema";
import { eq } from "drizzle-orm";
import type { PhotoWithRelations } from "../types";

type Photo = typeof progressPhotos.$inferSelect;
type NewPhoto = typeof progressPhotos.$inferInsert;

export function createPhoto(photo: Omit<NewPhoto, "created_at" | "updated_at">): Photo {
    const now = Date.now();
    return db
        .insert(progressPhotos)
        .values({ ...photo, created_at: now, updated_at: now })
        .returning()
        .get();
}

export function getPhotoById(id: number): Photo | undefined {
    return db.select().from(progressPhotos).where(eq(progressPhotos.id, id)).get();
}

export function listByLogEntry(logEntryId: number): Photo[] {
    return db
        .select()
        .from(progressPhotos)
        .where(eq(progressPhotos.log_entry_id, logEntryId))
        .orderBy(progressPhotos.created_at)
        .all();
}

export function listByLogEntryWithRelations(logEntryId: number): PhotoWithRelations[] {
    const rows = db
        .select({
            photo: progressPhotos,
            workout: {
                id: workouts.id,
                title: workouts.title,
                date: workouts.date,
            },
        })
        .from(progressPhotos)
        .leftJoin(workouts, eq(progressPhotos.workout_tag_id, workouts.id))
        .where(eq(progressPhotos.log_entry_id, logEntryId))
        .orderBy(progressPhotos.created_at)
        .all();

    return rows.map(({ photo, workout }) => ({
        ...photo,
        workoutTag: workout?.id
            ? { workoutId: workout.id, workoutTitle: workout.title ?? null, workoutDate: workout.date }
            : null,
    }));
}

export function updatePhoto(id: number, changes: Partial<Omit<NewPhoto, "id" | "created_at">>): Photo | undefined {
    return db
        .update(progressPhotos)
        .set({ ...changes, updated_at: Date.now() })
        .where(eq(progressPhotos.id, id))
        .returning()
        .get();
}

export function deletePhoto(id: number): void {
    db.delete(progressPhotos).where(eq(progressPhotos.id, id)).run();
}
