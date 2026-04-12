import { db } from "@/src/services/db";
import { aiMemories } from "@/src/services/db/schema";
import { eq } from "drizzle-orm";

export type AiMemory = typeof aiMemories.$inferSelect;

export function getAllMemories(): AiMemory[] {
    return db.select().from(aiMemories).orderBy(aiMemories.created_at).all();
}

export function addMemory(content: string): AiMemory {
    const rows = db
        .insert(aiMemories)
        .values({ content: content.trim(), created_at: Date.now() })
        .returning()
        .all();
    return rows[0];
}

export function updateMemory(id: number, content: string): void {
    db.update(aiMemories)
        .set({ content: content.trim() })
        .where(eq(aiMemories.id, id))
        .run();
}

export function deleteMemory(id: number): void {
    db.delete(aiMemories).where(eq(aiMemories.id, id)).run();
}
