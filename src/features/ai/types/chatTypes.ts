import type { AiToolCall, AiToolResult } from "./toolDefinitionTypes";
import type { AiMealPlanEntry } from "./types";

// ── Chat message types for the UI ─────────────────────────

export type ChatRole = "user" | "assistant" | "tool-request" | "tool-result";

export interface ToolResultData {
    mealPlanEntries?: AiMealPlanEntry[];
    imported?: boolean;
    dismissed?: boolean;
}

export interface UiChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    toolCall?: AiToolCall;
    toolResult?: AiToolResult;
    toolResultData?: ToolResultData;
    toolCallId?: string;
    timestamp: number;
}

// ── Options ───────────────────────────────────────────────

export interface ChatSendOptions {
    messages: UiChatMessage[];
    userText: string;
    onMessage: (msg: UiChatMessage) => void;
    onStreamStatus?: (status: string) => void;
    onStreamToken?: (accumulated: string) => void;
    onStreamingToolData?: (data: ToolResultData) => void;
    signal?: AbortSignal;
}

export interface ToolApprovalOptions {
    messages: UiChatMessage[];
    toolCall: AiToolCall;
    onMessage: (msg: UiChatMessage) => void;
    onStreamStatus?: (status: string) => void;
    onStreamToken?: (accumulated: string) => void;
    onStreamingToolData?: (data: ToolResultData) => void;
    signal?: AbortSignal;
    toolCallId?: string;
}

// ── ID generator ──────────────────────────────────────────

let msgCounter = 0;
export function nextId(): string {
    return `msg_${Date.now()}_${++msgCounter}`;
}
