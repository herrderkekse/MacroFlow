import { db } from "@/src/services/db";
import { exerciseSets, setVideos } from "@/src/services/db/schema";
import { eq, isNotNull } from "drizzle-orm";

export type SetVideo = typeof setVideos.$inferSelect;

/** Every attached video. The table holds one row per filmed set, so it stays small. */
export function listSetVideos(): SetVideo[] {
    return db.select().from(setVideos).all();
}

export function getSetVideo(setUuid: string): SetVideo | undefined {
    return db.select().from(setVideos).where(eq(setVideos.set_uuid, setUuid)).get();
}

/** Attaches a file to a set, replacing the one it had. */
export function putSetVideo(setUuid: string, fileName: string, durationMs: number | null): void {
    const row = { set_uuid: setUuid, file_name: fileName, duration_ms: durationMs, created_at: Date.now() };
    db.insert(setVideos)
        .values(row)
        .onConflictDoUpdate({ target: setVideos.set_uuid, set: row })
        .run();
}

export function deleteSetVideoRow(setUuid: string): void {
    db.delete(setVideos).where(eq(setVideos.set_uuid, setUuid)).run();
}

export function getSetUuid(setId: number): string | null {
    const row = db.select({ uuid: exerciseSets.uuid }).from(exerciseSets).where(eq(exerciseSets.id, setId)).get();
    return row?.uuid ?? null;
}

/** The uuids of all sets that still exist, to find videos whose set is gone. */
export function listSetUuids(): Set<string> {
    const rows = db.select({ uuid: exerciseSets.uuid }).from(exerciseSets).where(isNotNull(exerciseSets.uuid)).all();
    return new Set(rows.map((r) => r.uuid as string));
}
