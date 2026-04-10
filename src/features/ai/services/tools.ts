import { formatDateKey } from "@/src/utils/date";
import { AI_TOOLS } from "./toolDefinitions";

// Re-export everything so existing consumers keep working
export { AI_TOOLS, toAiSdkTools, VALID_MEAL_TYPES, type AiToolCall, type AiToolDefinition, type AiToolResult, type ToolParameterProperty } from "./toolDefinitions";
export { executeTool, importMealPlanEntries } from "./toolExecutors";

// ── Approval gating ───────────────────────────────────────

export function toolNeedsApproval(toolName: string): boolean {
    const tool = AI_TOOLS.find((t) => t.name === toolName);
    return tool?.needsApproval ?? true;
}

// ── System prompt for AI SDK native tool calling ──────────

export function buildToolSystemPrompt(): string {
    const today = formatDateKey(new Date());

    return [
        "You are a helpful nutrition and meal planning assistant inside a food tracking app called MacroFlow.",
        "You can help users with their diet by using the provided tools.",
        "",
        `TODAY'S DATE: ${today}`,
        "",
        "RULES:",
        "- Only call ONE tool at a time.",
        "- Be concise and helpful. Use the user's language when possible.",
        "- When a meal plan is generated, briefly summarize what was created.",
        "- Before creating an entry, ALWAYS use search_templates first to find the correct food_id. Never guess IDs.",
        "- Before modifying or removing an entry, ALWAYS use read_entries first to find the correct entry_id.",
        "- When the user says 'today', use the date provided above. Calculate other relative dates from it.",
    ].join("\n");
}
