import { db } from "@/src/services/db";
import { chatMessages, chatSessions } from "@/src/services/db/schema";
import { desc, eq } from "drizzle-orm";

export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;

export function createChatSession(title?: string): ChatSession {
    const now = Date.now();
    return db.insert(chatSessions).values({
        title: title ?? "New Chat",
        created_at: now,
        updated_at: now,
    }).returning().get();
}

export function getAllChatSessions(): ChatSession[] {
    return db.select().from(chatSessions).orderBy(desc(chatSessions.updated_at)).all();
}

export function deleteChatSession(sessionId: number) {
    db.delete(chatMessages).where(eq(chatMessages.session_id, sessionId)).run();
    db.delete(chatSessions).where(eq(chatSessions.id, sessionId)).run();
}

export function updateChatSessionTitle(sessionId: number, title: string) {
    db.update(chatSessions).set({ title, updated_at: Date.now() }).where(eq(chatSessions.id, sessionId)).run();
}

export function touchChatSession(sessionId: number) {
    db.update(chatSessions).set({ updated_at: Date.now() }).where(eq(chatSessions.id, sessionId)).run();
}

export function addChatMessage(msg: {
    session_id: number;
    role: string;
    content: string;
    tool_call_json?: string | null;
    tool_result_json?: string | null;
    tool_result_data_json?: string | null;
    tool_call_id?: string | null;
    timestamp: number;
}): ChatMessageRow {
    return db.insert(chatMessages).values(msg).returning().get();
}

export function getChatMessages(sessionId: number): ChatMessageRow[] {
    return db.select().from(chatMessages)
        .where(eq(chatMessages.session_id, sessionId))
        .orderBy(chatMessages.timestamp)
        .all();
}
