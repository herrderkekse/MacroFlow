import { db } from "@/src/services/db";
import { barPaths, setVideos } from "@/src/services/db/schema";
import { and, eq } from "drizzle-orm";
import type { BarPathData } from "../types";

/** The path tracked in the set's video, if it was tracked in the video the set has now. */
export function getBarPath(setUuid: string, videoFile: string): BarPathData | null {
    const row = db.select().from(barPaths)
        .where(and(eq(barPaths.set_uuid, setUuid), eq(barPaths.video_file, videoFile)))
        .get();
    if (!row) return null;
    try {
        const data = JSON.parse(row.data) as BarPathData;
        return data.version === 1 ? data : null;
    } catch {
        return null;
    }
}

/** Stores the path tracked in a set's video, replacing the one it had. */
export function putBarPath(setUuid: string, videoFile: string, data: BarPathData): void {
    const row = { set_uuid: setUuid, video_file: videoFile, data: JSON.stringify(data), created_at: Date.now() };
    db.insert(barPaths).values(row).onConflictDoUpdate({ target: barPaths.set_uuid, set: row }).run();
}

/** Set uuids whose video has a bar path that still applies, to mark those sets. */
export function listTrackedSetUuids(): Set<string> {
    const rows = db.select({ uuid: barPaths.set_uuid })
        .from(barPaths)
        .innerJoin(setVideos, and(eq(setVideos.set_uuid, barPaths.set_uuid), eq(setVideos.file_name, barPaths.video_file)))
        .all();
    return new Set(rows.map((r) => r.uuid));
}

/**
 * Drops paths whose video is gone or was replaced (trimmed again, or removed
 * with its set). Run once at startup, after the set videos have been swept.
 */
export function sweepBarPaths(): void {
    const kept = listTrackedSetUuids();
    for (const row of db.select({ uuid: barPaths.set_uuid }).from(barPaths).all()) {
        if (!kept.has(row.uuid)) db.delete(barPaths).where(eq(barPaths.set_uuid, row.uuid)).run();
    }
}
