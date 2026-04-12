import { addMemory } from "../aiMemoriesDb";
import type { AiToolResult } from "../../types/toolDefinitionTypes";

type ToolExecutor = (args: Record<string, unknown>) => AiToolResult;

function executeSaveMemory(args: Record<string, unknown>): AiToolResult {
    const content = String(args.content ?? "").trim();
    if (!content) return { success: false, summary: "Memory content cannot be empty." };
    if (content.length > 500) return { success: false, summary: "Memory content is too long. Max 500 characters." };

    addMemory(content);
    return { success: true, summary: `Memory saved: "${content}"` };
}

export const memoryToolExecutors: Record<string, ToolExecutor> = {
    save_memory: executeSaveMemory,
};
