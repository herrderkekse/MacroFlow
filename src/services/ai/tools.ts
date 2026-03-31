import {
    addEntry,
    deleteEntry,
    getAllFoods,
    getAllRecipes,
    getEntriesByDate,
    getEntriesByDateRange,
    getEntryById,
    getFoodById,
    getGoals,
    getRecipeItems,
    searchFoodsByName,
    searchRecipesByName,
    updateEntry,
} from "@/src/db/queries";
import { shiftCalendarDate } from "@/src/utils/date";
import { formatDateKey, parseDateKey } from "@/src/utils/date";
import logger from "@/src/utils/logger";
import { buildMealPlanPrompt } from "./index";
import type { AiFoodPayload, AiGoalsPayload, AiMealPlanEntry, AiRecipePayload, OpenAiTool } from "./types";

// ── Tool definition types ─────────────────────────────────

/** JSON Schema-style parameter definition for a tool. */
export interface ToolParameterProperty {
    type: string;
    description: string;
    enum?: string[];
}

/** A callable tool the AI can invoke. */
export interface AiToolDefinition {
    name: string;
    description: string;
    /** Whether the tool requires user approval before execution. Defaults to true. */
    needsApproval: boolean;
    parameters: {
        type: "object";
        properties: Record<string, ToolParameterProperty>;
        required: string[];
    };
}

/** A parsed tool call from the AI response. */
export interface AiToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

/** Result of executing a tool. */
export interface AiToolResult {
    success: boolean;
    summary: string;
    data?: unknown;
}

// ── Tool definitions ──────────────────────────────────────

const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const createMealPlanTool: AiToolDefinition = {
    name: "create_meal_plan",
    description:
        "Generate a meal plan for the user based on their food library, macro goals, and preferences. " +
        "The plan entries will be added as scheduled entries to the user's log.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            days: {
                type: "number",
                description: "Number of days to plan (1-7).",
            },
            liked_foods: {
                type: "string",
                description: "Comma-separated list of foods the user likes. Can be empty.",
            },
            disliked_foods: {
                type: "string",
                description: "Comma-separated list of foods the user dislikes. Can be empty.",
            },
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
            date: {
                type: "string",
                description: "The date to read entries for, in YYYY-MM-DD format.",
            },
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
            food_id: {
                type: "number",
                description: "The ID of the food from the user's library.",
            },
            quantity_grams: {
                type: "number",
                description: "Amount in grams.",
            },
            date: {
                type: "string",
                description: "The date for the entry, in YYYY-MM-DD format.",
            },
            meal_type: {
                type: "string",
                description: "The meal type.",
                enum: ["breakfast", "lunch", "dinner", "snack"],
            },
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
            entry_id: {
                type: "number",
                description: "The ID of the entry to move.",
            },
            target_date: {
                type: "string",
                description: "The new date in YYYY-MM-DD format. Omit to keep current date.",
            },
            target_meal_type: {
                type: "string",
                description: "The new meal type. Omit to keep current meal type.",
                enum: ["breakfast", "lunch", "dinner", "snack"],
            },
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
            entry_id: {
                type: "number",
                description: "The ID of the entry to update.",
            },
            quantity_grams: {
                type: "number",
                description: "The new amount in grams.",
            },
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
            entry_id: {
                type: "number",
                description: "The ID of the entry to remove.",
            },
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
            query: {
                type: "string",
                description: "Search term to match against food and recipe names.",
            },
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
            days: {
                type: "number",
                description: "Number of days to look back (1-30). 1 means today only.",
            },
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
            days: {
                type: "number",
                description: "Number of days to look back (1-30). 1 means today only.",
            },
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

/** Convert internal tool definitions to the OpenAI-compatible tools format. */
export function toOpenAiTools(): OpenAiTool[] {
    return AI_TOOLS.map((tool) => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
}

// ── Tool registry (name → executor) ──────────────────────

type ToolExecutor = (args: Record<string, unknown>) => AiToolResult;

function executeCreateMealPlan(args: Record<string, unknown>): AiToolResult {
    const days = Math.max(1, Math.min(7, Number(args.days) || 3));
    const likedFoods = String(args.liked_foods ?? "");
    const dislikedFoods = String(args.disliked_foods ?? "");

    const goals = getGoals();
    if (!goals) {
        return { success: false, summary: "No daily macro goals set. Please configure goals first." };
    }

    const allFoods = getAllFoods();
    if (allFoods.length === 0) {
        return { success: false, summary: "No foods in library. Please add foods first." };
    }

    const foodPayload: AiFoodPayload[] = allFoods.map((f) => ({
        id: f.id,
        name: f.name,
        calories_per_100g: f.calories_per_100g,
        protein_per_100g: f.protein_per_100g,
        carbs_per_100g: f.carbs_per_100g,
        fat_per_100g: f.fat_per_100g,
        default_unit: f.default_unit,
        serving_size: f.serving_size,
    }));

    const allRecipes = getAllRecipes();
    const recipePayload: AiRecipePayload[] = allRecipes.map((r) => {
        const items = getRecipeItems(r.id);
        return {
            id: r.id,
            name: r.name,
            items: items.map((i) => ({
                food_id: i.recipe_items.food_id,
                quantity_grams: i.recipe_items.quantity_grams,
            })),
        };
    });

    const goalsPayload: AiGoalsPayload = {
        calories: goals.calories,
        protein: goals.protein,
        carbs: goals.carbs,
        fat: goals.fat,
    };

    // Build the prompt that will be used for a secondary AI call
    const messages = buildMealPlanPrompt(foodPayload, recipePayload, goalsPayload, {
        likedFoods,
        dislikedFoods,
        days,
    });

    return {
        success: true,
        summary: `Prepared meal plan request for ${days} day(s).`,
        data: {
            type: "meal_plan_request",
            messages,
            validFoodIds: allFoods.map((f) => f.id),
            goals: goalsPayload,
            foods: foodPayload,
        },
    };
}

function isValidDateKey(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(parseDateKey(date).getTime());
}

function isValidMealType(meal: unknown): meal is typeof VALID_MEAL_TYPES[number] {
    return typeof meal === "string" && VALID_MEAL_TYPES.includes(meal as any);
}

function executeReadEntries(args: Record<string, unknown>): AiToolResult {
    const date = String(args.date ?? "");
    if (!isValidDateKey(date)) {
        return { success: false, summary: "Invalid date format. Use YYYY-MM-DD." };
    }

    const rows = getEntriesByDate(parseDateKey(date));
    const result = rows.map((row) => ({
        entry_id: row.entries.id,
        food_id: row.entries.food_id,
        food_name: row.foods?.name ?? "Unknown",
        quantity_grams: row.entries.quantity_grams,
        quantity_unit: row.entries.quantity_unit,
        meal_type: row.entries.meal_type,
        is_scheduled: row.entries.is_scheduled,
        calories: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.calories_per_100g).toFixed(1) : 0,
        protein: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.protein_per_100g).toFixed(1) : 0,
        carbs: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.carbs_per_100g).toFixed(1) : 0,
        fat: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.fat_per_100g).toFixed(1) : 0,
    }));

    return {
        success: true,
        summary: `Found ${result.length} entries for ${date}.`,
        data: result,
    };
}

function executeCreateEntry(args: Record<string, unknown>): AiToolResult {
    const foodId = Number(args.food_id);
    const quantityGrams = Number(args.quantity_grams);
    const date = String(args.date ?? "");
    const mealType = String(args.meal_type ?? "");

    if (!foodId || isNaN(foodId)) {
        return { success: false, summary: "Invalid food_id." };
    }
    if (!quantityGrams || quantityGrams <= 0) {
        return { success: false, summary: "quantity_grams must be a positive number." };
    }
    if (!isValidDateKey(date)) {
        return { success: false, summary: "Invalid date format. Use YYYY-MM-DD." };
    }
    if (!isValidMealType(mealType)) {
        return { success: false, summary: `Invalid meal_type. Must be one of: ${VALID_MEAL_TYPES.join(", ")}.` };
    }

    const food = getFoodById(foodId);
    if (!food) {
        return { success: false, summary: `Food with id ${foodId} not found. Use search_templates to find valid food IDs.` };
    }

    const entry = addEntry({
        food_id: foodId,
        quantity_grams: quantityGrams,
        quantity_unit: "g",
        timestamp: Date.now(),
        date,
        meal_type: mealType,
    });

    return {
        success: true,
        summary: `Added ${quantityGrams}g of "${food.name}" to ${mealType} on ${date}.`,
        data: { entry_id: entry.id, food_name: food.name, quantity_grams: quantityGrams, date, meal_type: mealType },
    };
}

function executeMoveEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);
    const targetDate = args.target_date != null ? String(args.target_date) : undefined;
    const targetMealType = args.target_meal_type != null ? String(args.target_meal_type) : undefined;

    if (!entryId || isNaN(entryId)) {
        return { success: false, summary: "Invalid entry_id." };
    }
    if (!targetDate && !targetMealType) {
        return { success: false, summary: "Provide at least target_date or target_meal_type." };
    }
    if (targetDate && !isValidDateKey(targetDate)) {
        return { success: false, summary: "Invalid target_date format. Use YYYY-MM-DD." };
    }
    if (targetMealType && !isValidMealType(targetMealType)) {
        return { success: false, summary: `Invalid target_meal_type. Must be one of: ${VALID_MEAL_TYPES.join(", ")}.` };
    }

    const row = getEntryById(entryId);
    if (!row) {
        return { success: false, summary: `Entry with id ${entryId} not found. Use read_entries to find valid entry IDs.` };
    }

    const updates: Record<string, unknown> = {};
    if (targetDate) updates.date = targetDate;
    if (targetMealType) updates.meal_type = targetMealType;
    updateEntry(entryId, updates);

    const newDate = targetDate ?? row.entries.date;
    const newMeal = targetMealType ?? row.entries.meal_type;

    return {
        success: true,
        summary: `Moved entry ${entryId} ("${row.foods?.name ?? "Unknown"}") to ${newMeal} on ${newDate}.`,
        data: { entry_id: entryId, food_name: row.foods?.name, date: newDate, meal_type: newMeal },
    };
}

function executeUpdateEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);
    const quantityGrams = Number(args.quantity_grams);

    if (!entryId || isNaN(entryId)) {
        return { success: false, summary: "Invalid entry_id." };
    }
    if (!quantityGrams || quantityGrams <= 0) {
        return { success: false, summary: "quantity_grams must be a positive number." };
    }

    const row = getEntryById(entryId);
    if (!row) {
        return { success: false, summary: `Entry with id ${entryId} not found. Use read_entries to find valid entry IDs.` };
    }

    updateEntry(entryId, { quantity_grams: quantityGrams });

    return {
        success: true,
        summary: `Updated entry ${entryId} ("${row.foods?.name ?? "Unknown"}") to ${quantityGrams}g.`,
        data: { entry_id: entryId, food_name: row.foods?.name, quantity_grams: quantityGrams },
    };
}

function executeRemoveEntry(args: Record<string, unknown>): AiToolResult {
    const entryId = Number(args.entry_id);

    if (!entryId || isNaN(entryId)) {
        return { success: false, summary: "Invalid entry_id." };
    }

    const row = getEntryById(entryId);
    if (!row) {
        return { success: false, summary: `Entry with id ${entryId} not found. Use read_entries to find valid entry IDs.` };
    }

    deleteEntry(entryId);

    return {
        success: true,
        summary: `Removed entry ${entryId} ("${row.foods?.name ?? "Unknown"}", ${row.entries.quantity_grams}g from ${row.entries.meal_type} on ${row.entries.date}).`,
        data: { entry_id: entryId, food_name: row.foods?.name },
    };
}

function executeSearchTemplates(args: Record<string, unknown>): AiToolResult {
    const query = String(args.query ?? "").trim();
    if (!query) {
        return { success: false, summary: "Search query cannot be empty." };
    }

    const matchedFoods = searchFoodsByName(query).map((f) => ({
        type: "food" as const,
        id: f.id,
        name: f.name,
        calories_per_100g: f.calories_per_100g,
        protein_per_100g: f.protein_per_100g,
        carbs_per_100g: f.carbs_per_100g,
        fat_per_100g: f.fat_per_100g,
        default_unit: f.default_unit,
        serving_size: f.serving_size,
    }));

    const matchedRecipes = searchRecipesByName(query).map((r) => ({
        type: "recipe" as const,
        id: r.id,
        name: r.name,
    }));

    const results = [...matchedFoods, ...matchedRecipes];

    return {
        success: true,
        summary: `Found ${matchedFoods.length} food(s) and ${matchedRecipes.length} recipe(s) matching "${query}".`,
        data: results,
    };
}

function executeReadRecentEntries(args: Record<string, unknown>): AiToolResult {
    const days = Math.max(1, Math.min(30, Math.round(Number(args.days) || 1)));
    const today = new Date();
    const startDate = shiftCalendarDate(today, -(days - 1));

    const rows = getEntriesByDateRange(startDate, today);
    const grouped: Record<string, unknown[]> = {};

    for (const row of rows) {
        const date = row.entries.date;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push({
            entry_id: row.entries.id,
            food_id: row.entries.food_id,
            food_name: row.foods?.name ?? "Unknown",
            quantity_grams: row.entries.quantity_grams,
            meal_type: row.entries.meal_type,
            calories: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.calories_per_100g).toFixed(1) : 0,
            protein: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.protein_per_100g).toFixed(1) : 0,
            carbs: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.carbs_per_100g).toFixed(1) : 0,
            fat: row.foods ? +(row.entries.quantity_grams / 100 * row.foods.fat_per_100g).toFixed(1) : 0,
        });
    }

    return {
        success: true,
        summary: `Found ${rows.length} entries across ${Object.keys(grouped).length} day(s).`,
        data: grouped,
    };
}

function executeReadRecentMacros(args: Record<string, unknown>): AiToolResult {
    const days = Math.max(1, Math.min(30, Math.round(Number(args.days) || 1)));
    const today = new Date();
    const startDate = shiftCalendarDate(today, -(days - 1));

    const rows = getEntriesByDateRange(startDate, today);
    const dailyTotals: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};

    for (const row of rows) {
        const date = row.entries.date;
        if (!dailyTotals[date]) dailyTotals[date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        if (row.foods) {
            const q = row.entries.quantity_grams / 100;
            dailyTotals[date].calories += q * row.foods.calories_per_100g;
            dailyTotals[date].protein += q * row.foods.protein_per_100g;
            dailyTotals[date].carbs += q * row.foods.carbs_per_100g;
            dailyTotals[date].fat += q * row.foods.fat_per_100g;
        }
    }

    // Round the totals
    const result = Object.fromEntries(
        Object.entries(dailyTotals).map(([date, totals]) => [
            date,
            {
                calories: +totals.calories.toFixed(1),
                protein: +totals.protein.toFixed(1),
                carbs: +totals.carbs.toFixed(1),
                fat: +totals.fat.toFixed(1),
            },
        ]),
    );

    return {
        success: true,
        summary: `Macro totals for ${Object.keys(result).length} day(s).`,
        data: result,
    };
}

const toolExecutors: Record<string, ToolExecutor> = {
    create_meal_plan: executeCreateMealPlan,
    read_entries: executeReadEntries,
    create_entry: executeCreateEntry,
    move_entry: executeMoveEntry,
    update_entry: executeUpdateEntry,
    remove_entry: executeRemoveEntry,
    search_templates: executeSearchTemplates,
    read_recent_entries: executeReadRecentEntries,
    read_recent_macros: executeReadRecentMacros,
};

// ── Public API ────────────────────────────────────────────

/** Check whether a tool requires user approval before execution. */
export function toolNeedsApproval(toolName: string): boolean {
    const tool = AI_TOOLS.find((t) => t.name === toolName);
    return tool?.needsApproval ?? true;
}

/** Execute a tool by name. Returns the result synchronously. */
export function executeTool(call: AiToolCall): AiToolResult {
    const executor = toolExecutors[call.name];
    if (!executor) {
        logger.warn("[AI/Tools] Unknown tool requested", { name: call.name });
        return { success: false, summary: `Unknown tool: ${call.name}` };
    }

    logger.info("[AI/Tools] Executing tool", { name: call.name, args: call.arguments });
    return executor(call.arguments);
}

/**
 * Import meal plan entries into the user's log as scheduled entries.
 * Returns the count of imported entries.
 */
export function importMealPlanEntries(entries: AiMealPlanEntry[]): number {
    const ts = Date.now();
    let count = 0;
    for (const entry of entries) {
        addEntry({
            food_id: entry.food_id,
            quantity_grams: entry.quantity_grams,
            quantity_unit: "g",
            timestamp: ts,
            date: entry.date,
            meal_type: entry.meal_type,
            is_scheduled: 1,
        });
        count++;
    }
    logger.info("[AI/Tools] Imported meal plan entries", { count });
    return count;
}

/** Build the system prompt describing available tools (used as fallback when native tool calling is unavailable). */
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

/** Build a minimal system prompt for use with native tool calling (no tool format instructions needed). */
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

/** Try to parse a tool call from an AI text response (prompt-based fallback). Returns null if no tool call found. */
export function parseToolCall(response: string): AiToolCall | null {
    // Strategy 1: Look for ```tool ... ``` blocks (primary format)
    const toolBlockRegex = /```tool\s*\n?([\s\S]*?)\n?```/;
    const match = response.match(toolBlockRegex);
    if (match) {
        const parsed = tryParseToolJson(match[1].trim());
        if (parsed) return parsed;
    }

    // Strategy 2: Look for ```json ... ``` or ``` ... ``` blocks containing tool JSON
    const genericBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
    const genericMatch = response.match(genericBlockRegex);
    if (genericMatch) {
        const parsed = tryParseToolJson(genericMatch[1].trim());
        if (parsed) return parsed;
    }

    // Strategy 3: Try to find a raw JSON object with "name" field in the response
    const jsonObjectRegex = /\{[^{}]*"name"\s*:\s*"[^"]+"\s*[,}][\s\S]*?\}/;
    const jsonMatch = response.match(jsonObjectRegex);
    if (jsonMatch) {
        const parsed = tryParseToolJson(jsonMatch[0]);
        if (parsed) return parsed;
    }

    return null;
}

/** Try to parse a JSON string as a tool call. Returns null on failure. */
function tryParseToolJson(jsonStr: string): AiToolCall | null {
    try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.name && typeof parsed.name === "string") {
            return {
                name: parsed.name,
                arguments: parsed.arguments ?? {},
            };
        }
    } catch {
        // Not valid JSON
    }
    return null;
}
