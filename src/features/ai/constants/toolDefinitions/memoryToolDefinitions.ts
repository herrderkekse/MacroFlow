import type { AiToolDefinition } from "../../types/toolDefinitionTypes";

const saveMemoryTool: AiToolDefinition = {
    name: "save_memory",
    description:
        "Permanently save a piece of information about the user (e.g. food preferences, dietary restrictions, goals) " +
        "so you remember it in future conversations. " +
        "Use this whenever the user shares personal preferences or information that would be useful to recall later. " +
        "Keep memories concise and factual (e.g. \"User dislikes fish and broccoli\", \"User prefers high-protein breakfasts\").",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: {
            content: { type: "string", description: "The information to remember. Keep it short and factual." },
        },
        required: ["content"],
    },
};

export const MEMORY_TOOLS: AiToolDefinition[] = [saveMemoryTool];
