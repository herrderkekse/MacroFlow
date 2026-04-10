import { jsonSchema } from "ai";

// ── Tool definition types ─────────────────────────────────

export interface ToolParameterProperty {
    type: string;
    description: string;
    enum?: string[];
}

export interface AiToolDefinition {
    name: string;
    description: string;
    needsApproval: boolean;
    parameters: {
        type: "object";
        properties: Record<string, ToolParameterProperty>;
        required: string[];
    };
}

export interface AiToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface AiToolResult {
    success: boolean;
    summary: string;
    data?: unknown;
}

// ── Tool definitions ──────────────────────────────────────

export const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const createMealPlanTool: AiToolDefinition = {
    name: "create_meal_plan",
    description:
        "Generate a meal plan for the user based on their food library, macro goals, and preferences. " +
        "The plan entries will be added as scheduled entries to the user's log.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            days: { type: "number", description: "Number of days to plan (1-7)." },
            liked_foods: { type: "string", description: "Comma-separated list of foods the user likes. Can be empty." },
            disliked_foods: { type: "string", description: "Comma-separated list of foods the user dislikes. Can be empty." },
        },
        required: ["days"],
    },
};

const readEntriesTool: AiToolDefinition = {
    name: "read_entries",
    description:
        "Read all food log entries for a specific date. Returns entry IDs, food names, quantities, meal types, and macro totals. " +
        "Use this to answer questions about what the user ate on a given day.",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: {
            date: { type: "string", description: "The date to read entries for, in YYYY-MM-DD format." },
        },
        required: ["date"],
    },
};

const createEntryTool: AiToolDefinition = {
    name: "create_entry",
    description:
        "Log a food entry to the user's diary. Requires a valid food_id from the user's food library. " +
        "Use search_templates first to find the correct food_id.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            food_id: { type: "number", description: "The ID of the food from the user's library." },
            quantity_grams: { type: "number", description: "Amount in grams." },
            date: { type: "string", description: "The date for the entry, in YYYY-MM-DD format." },
            meal_type: { type: "string", description: "The meal type.", enum: ["breakfast", "lunch", "dinner", "snack"] },
        },
        required: ["food_id", "quantity_grams", "date", "meal_type"],
    },
};

const moveEntryTool: AiToolDefinition = {
    name: "move_entry",
    description:
        "Move an existing food log entry to a different date and/or meal type. " +
        "Use read_entries first to get the entry_id.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            entry_id: { type: "number", description: "The ID of the entry to move." },
            target_date: { type: "string", description: "The new date in YYYY-MM-DD format. Omit to keep current date." },
            target_meal_type: { type: "string", description: "The new meal type. Omit to keep current meal type.", enum: ["breakfast", "lunch", "dinner", "snack"] },
        },
        required: ["entry_id"],
    },
};

const updateEntryTool: AiToolDefinition = {
    name: "update_entry",
    description:
        "Update the quantity of an existing food log entry. " +
        "Use read_entries first to get the entry_id.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            entry_id: { type: "number", description: "The ID of the entry to update." },
            quantity_grams: { type: "number", description: "The new amount in grams." },
        },
        required: ["entry_id", "quantity_grams"],
    },
};

const removeEntryTool: AiToolDefinition = {
    name: "remove_entry",
    description:
        "Remove a food log entry from the user's diary. " +
        "Use read_entries first to get the entry_id.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            entry_id: { type: "number", description: "The ID of the entry to remove." },
        },
        required: ["entry_id"],
    },
};

const searchTemplatesTool: AiToolDefinition = {
    name: "search_templates",
    description:
        "Search the user's food library and recipes by name. Returns matching foods with their IDs, macros, and serving info. " +
        "Use this to find food_id values before creating entries.",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "Search term to match against food and recipe names." },
        },
        required: ["query"],
    },
};

const readRecentEntriesTool: AiToolDefinition = {
    name: "read_recent_entries",
    description:
        "Read all food log entries for the last X days (including today). Returns entry details grouped by date. " +
        "Use this to see what the user ate recently.",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: {
            days: { type: "number", description: "Number of days to look back (1-30). 1 means today only." },
        },
        required: ["days"],
    },
};

const readRecentMacrosTool: AiToolDefinition = {
    name: "read_recent_macros",
    description:
        "Read the total macro sums for each of the last X days (including today). Returns daily totals only, not individual food entries. " +
        "Use this for a quick overview of recent nutrition.",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: {
            days: { type: "number", description: "Number of days to look back (1-30). 1 means today only." },
        },
        required: ["days"],
    },
};

export const AI_TOOLS: AiToolDefinition[] = [
    createMealPlanTool,
    readEntriesTool,
    createEntryTool,
    moveEntryTool,
    updateEntryTool,
    removeEntryTool,
    searchTemplatesTool,
    readRecentEntriesTool,
    readRecentMacrosTool,
];

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
