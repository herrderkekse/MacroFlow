import { formatDateKey } from "@/src/utils/date";
import { jsonSchema } from "ai";
import { AI_TOOLS } from "../constants/toolDefinitions";

// Re-export everything so existing consumers keep working
export type { AiToolCall, AiToolDefinition, AiToolResult, ToolParameterProperty } from "../types/toolDefinitionTypes";

// ── Approval gating ───────────────────────────────────────

export function toolNeedsApproval(toolName: string): boolean {
    const tool = AI_TOOLS.find((t) => t.name === toolName);
    return tool?.needsApproval ?? true;
}

// ── System prompt for AI SDK native tool calling ──────────

export function buildToolSystemPrompt(memories: string[] = []): string {
    const today = formatDateKey(new Date());

    const parts = [
        "You are a helpful nutrition and meal planning assistant inside a food tracking app called MacroFlow.",
        "You can help users with their diet by using the provided tools or your own knowledge.",
        "",
        `TODAY'S DATE: ${today}`,
        "",
        "RULES:",
        "- Only call ONE tool at a time.",
        "- If theres a tool that can help you, use it. If there isn't, try to help the user with your own knowledge.",
        "- If the tool didnt help you solve the user's problem, try a different tool or use your own knowledge.",
        "- Consider the user's intent, not just the literal meaning of their message.",
        "- Be concise and helpful. Use the user's language when possible.",
        "- When using a tool, briefly summarize what has been done.",
        "- Before creating an entry, ALWAYS use search_templates first to find the correct food_id. Never guess IDs.",
        "- Before modifying or removing an entry, ALWAYS use read_entries first to find the correct entry_id.",
        "- When the user says 'today', use the date provided above. Calculate other relative dates from it.",
        "- When the user shares new preferences or personal information, use the save_memory tool to store it.",
        "",
        "UNITS:",
        "- When logging or updating food entries you can use any standard unit (g, ml, oz, fl_oz, cup, tbsp, tsp, lb) or a custom serving unit defined on the food.",
        "- Use search_library to see which units are available for a food (serving_units field).",
        "- Prefer the food's custom serving units or default_unit when they make sense (e.g. '1 piece' instead of guessing grams).",
        "- If no custom unit fits, use a standard unit that is natural for the food (e.g. ml for liquids, g for solids).",
    ];

    if (memories.length > 0) {
        parts.push(
            "",
            "MEMORIES (things you know about this user):",
            ...memories.map((m) => `- ${m}`),
        );
    }

    return parts.join("\n");
}


// ── Converters ────────────────────────────────────────────

export function toAiSdkTools(): Record<string, { description: string; parameters: ReturnType<typeof jsonSchema> }> {
    const tools: Record<string, { description: string; inputSchema: ReturnType<typeof jsonSchema> }> = {};
    for (const tool of AI_TOOLS) {
        tools[tool.name] = {
            description: tool.description,
            inputSchema: jsonSchema(tool.parameters),
        };
    }
    return tools;
}