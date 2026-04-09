import { formatDateKey } from "@/src/utils/date";
import { AI_TOOLS } from "./toolDefinitions";

// Re-export everything so existing consumers keep working
export { AI_TOOLS, toOpenAiTools, VALID_MEAL_TYPES, type AiToolCall, type AiToolDefinition, type AiToolResult, type ToolParameterProperty } from "./toolDefinitions";
export { executeTool, importMealPlanEntries } from "./toolExecutors";

// ── Approval gating ───────────────────────────────────────

export function toolNeedsApproval(toolName: string): boolean {
    const tool = AI_TOOLS.find((t) => t.name === toolName);
    return tool?.needsApproval ?? true;
}

// ── Prompt builders ───────────────────────────────────────

export function buildToolSystemPrompt(): string {
    const today = formatDateKey(new Date());

    const toolDescriptions = AI_TOOLS.map((tool) => {
        const params = Object.entries(tool.parameters.properties)
            .map(([name, prop]) => {
                const req = tool.parameters.required.includes(name) ? " (required)" : " (optional)";
                const enumStr = prop.enum ? ` [${prop.enum.join(", ")}]` : "";
                return `    - ${name}${req}: ${prop.description}${enumStr}`;
            })
            .join("\n");
        const approval = tool.needsApproval ? "Requires user approval." : "Runs automatically.";
        return `Tool: ${tool.name}\n  Description: ${tool.description}\n  ${approval}\n  Parameters:\n${params}`;
    }).join("\n\n");

    return [
        "You are a helpful nutrition and meal planning assistant inside a food tracking app called MacroFlow.",
        "You can help users with their diet by using available tools.",
        "",
        `TODAY'S DATE: ${today}`,
        "",
        "AVAILABLE TOOLS:",
        toolDescriptions,
        "",
        "TOOL CALLING FORMAT:",
        "When you want to use a tool, respond with ONLY a JSON block in this exact format — no other text before or after:",
        '```tool',
        '{"name": "tool_name", "arguments": {"param1": "value1"}}',
        '```',
        "",
        "EXAMPLES:",
        "",
        'User: "What did I eat today?"',
        "Response:",
        '```tool',
        `{"name": "read_entries", "arguments": {"date": "${today}"}}`,
        '```',
        "",
        'User: "Log 200g of chicken breast for lunch"',
        "Response:",
        '```tool',
        '{"name": "search_templates", "arguments": {"query": "chicken breast"}}',
        '```',
        "",
        'After receiving search_templates result with food_id 5:',
        '```tool',
        `{"name": "create_entry", "arguments": {"food_id": 5, "quantity_grams": 200, "date": "${today}", "meal_type": "lunch"}}`,
        '```',
        "",
        "IMPORTANT RULES:",
        "- Only call ONE tool at a time.",
        "- When calling a tool, respond with ONLY the tool block above — no extra text.",
        "- After a tool executes, you will receive the result and can respond to the user.",
        "- If you don't need a tool, just respond normally in plain text.",
        "- Be concise and helpful. Use the user's language when possible.",
        "- When a meal plan is generated, briefly summarize what was created.",
        "- Before creating an entry, ALWAYS use search_templates first to find the correct food_id. Never guess IDs.",
        "- Before modifying or removing an entry, ALWAYS use read_entries first to find the correct entry_id.",
        "- When the user says 'today', use the date provided above. Calculate other relative dates from it.",
    ].join("\n");
}

export function buildNativeToolSystemPrompt(): string {
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

// ── Tool-call parsing (prompt-based fallback) ─────────────

export function parseToolCall(response: string): { name: string; arguments: Record<string, unknown> } | null {
    const toolBlockRegex = /```tool\s*\n?([\s\S]*?)\n?```/;
    const match = response.match(toolBlockRegex);
    if (match) {
        const parsed = tryParseToolJson(match[1].trim());
        if (parsed) return parsed;
    }

    const genericBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
    const genericMatch = response.match(genericBlockRegex);
    if (genericMatch) {
        const parsed = tryParseToolJson(genericMatch[1].trim());
        if (parsed) return parsed;
    }

    const jsonObjectRegex = /\{[^{}]*"name"\s*:\s*"[^"]+"\s*[,}][\s\S]*?\}/;
    const jsonMatch = response.match(jsonObjectRegex);
    if (jsonMatch) {
        const parsed = tryParseToolJson(jsonMatch[0]);
        if (parsed) return parsed;
    }

    return null;
}

function tryParseToolJson(jsonStr: string): { name: string; arguments: Record<string, unknown> } | null {
    try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.name && typeof parsed.name === "string") {
            return { name: parsed.name, arguments: parsed.arguments ?? {} };
        }
    } catch {
        // Not valid JSON
    }
    return null;
}
