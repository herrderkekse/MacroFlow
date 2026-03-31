import { addEntry, getAllFoods, getAllRecipes, getGoals, getRecipeItems } from "@/src/db/queries";
import logger from "@/src/utils/logger";
import { buildMealPlanPrompt } from "./index";
import type { AiFoodPayload, AiGoalsPayload, AiMealPlanEntry, AiRecipePayload } from "./types";

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

const createMealPlanTool: AiToolDefinition = {
    name: "create_meal_plan",
    description:
        "Generate a meal plan for the user based on their food library, macro goals, and preferences. " +
        "The plan entries will be added as scheduled entries to the user's log.",
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

export const AI_TOOLS: AiToolDefinition[] = [createMealPlanTool];

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

const toolExecutors: Record<string, ToolExecutor> = {
    create_meal_plan: executeCreateMealPlan,
};

// ── Public API ────────────────────────────────────────────

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

/** Build the system prompt describing available tools. */
export function buildToolSystemPrompt(): string {
    const toolDescriptions = AI_TOOLS.map((tool) => {
        const params = Object.entries(tool.parameters.properties)
            .map(([name, prop]) => {
                const req = tool.parameters.required.includes(name) ? " (required)" : " (optional)";
                return `    - ${name}${req}: ${prop.description}`;
            })
            .join("\n");
        return `Tool: ${tool.name}\n  Description: ${tool.description}\n  Parameters:\n${params}`;
    }).join("\n\n");

    return [
        "You are a helpful nutrition and meal planning assistant inside a food tracking app called MacroFlow.",
        "You can help users with their diet by using available tools.",
        "",
        "AVAILABLE TOOLS:",
        toolDescriptions,
        "",
        "TOOL CALLING FORMAT:",
        "When you want to use a tool, respond with ONLY a JSON block in this exact format:",
        '```tool',
        '{"name": "tool_name", "arguments": {"param1": "value1"}}',
        '```',
        "",
        "IMPORTANT RULES:",
        "- Only call ONE tool at a time.",
        "- After a tool executes, you will receive the result and can respond to the user.",
        "- If you don't need a tool, just respond normally in plain text.",
        "- Be concise and helpful. Use the user's language when possible.",
        "- When a meal plan is generated, briefly summarize what was created.",
    ].join("\n");
}

/** Try to parse a tool call from an AI response. Returns null if no tool call found. */
export function parseToolCall(response: string): AiToolCall | null {
    // Look for ```tool ... ``` blocks
    const toolBlockRegex = /```tool\s*\n?([\s\S]*?)\n?```/;
    const match = response.match(toolBlockRegex);
    if (!match) return null;

    try {
        const parsed = JSON.parse(match[1].trim());
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
