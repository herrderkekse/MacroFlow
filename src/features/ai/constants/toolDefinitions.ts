import type { AiToolDefinition } from "../types/toolDefinitionTypes";
import { TEMPLATE_TOOLS } from "./templateToolDefinitions";

// ── Tool definitions ──────────────────────────────────────

export const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const createMealPlanTool: AiToolDefinition = {
    name: "create_meal_plan",
    description:
        "Generate a meal plan for the user based on their food library, macro goals, and preferences. " +
        "The plan entries will be added as scheduled entries to the user's log. " +
        "Use this ONLY for ENTIRE days and only from today. E.g. for \"today and next 3 days\", NOT for \"tomorrow's dinner\". " +
        "NEVER use the create_meal_plan tool for partial days. It's only for creating entire days of meal plans, starting from today. " +
        "\"Recommend a meal for tomorrow's dinner\" is NOT an appropriate use of create_meal_plan. " +
        "Instead, recommend a meal using your own knowledge or the search_templates tool, and then log it with create_entry.",
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
        "Use this to find food_id values before creating entries. " +
        "Its a simple text inclusion search, so searching for 'chicken' will match 'grilled chicken breast' and 'chicken salad' (if they exist), etc." +
        "Searching for something like \"dinner\" or \"healty recipes\" will most likely NOT return relevant results, so DONT use it for that.",
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
    saveMemoryTool,
    ...TEMPLATE_TOOLS,
];