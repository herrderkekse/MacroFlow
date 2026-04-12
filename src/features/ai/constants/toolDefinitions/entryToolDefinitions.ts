import type { AiToolDefinition } from "../../types/toolDefinitionTypes";

export const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

// ── Log entry read tools ───────────────────────────────────

const readLogEntriesTool: AiToolDefinition = {
    name: "read_log_entries",
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

const readRecentLogEntriesTool: AiToolDefinition = {
    name: "read_recent_log_entries",
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

// ── Log entry write tools ─────────────────────────────────

const logFoodTool: AiToolDefinition = {
    name: "log_food",
    description:
        "Log a food entry to the user's diary. Requires a valid food_id from the user's food library. " +
        "Use search_library first to find the correct food_id.",
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

const moveLogEntryTool: AiToolDefinition = {
    name: "move_log_entry",
    description:
        "Move an existing food log entry to a different date and/or meal type. " +
        "Use read_log_entries first to get the entry_id.",
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

const updateLogEntryTool: AiToolDefinition = {
    name: "update_log_entry",
    description:
        "Update the quantity of an existing food log entry. " +
        "Use read_log_entries first to get the entry_id.",
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

const deleteLogEntryTool: AiToolDefinition = {
    name: "delete_log_entry",
    description:
        "Remove a food log entry from the user's diary. " +
        "Use read_log_entries first to get the entry_id.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            entry_id: { type: "number", description: "The ID of the entry to remove." },
        },
        required: ["entry_id"],
    },
};

export const ENTRY_TOOLS: AiToolDefinition[] = [
    readLogEntriesTool,
    readRecentLogEntriesTool,
    readRecentMacrosTool,
    logFoodTool,
    moveLogEntryTool,
    updateLogEntryTool,
    deleteLogEntryTool,
];
