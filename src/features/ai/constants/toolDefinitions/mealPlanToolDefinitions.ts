import type { AiToolDefinition } from "../../types/toolDefinitionTypes";

const createMealPlanTool: AiToolDefinition = {
    name: "create_meal_plan",
    description:
        "Generate a meal plan for the user based on their food library, macro goals, and preferences. " +
        "The plan entries will be added as scheduled entries to the user's log. " +
        "Use this ONLY for ENTIRE days and only from today. E.g. for \"today and next 3 days\", NOT for \"tomorrow's dinner\". " +
        "NEVER use the create_meal_plan tool for partial days. It's only for creating entire days of meal plans, starting from today. " +
        "\"Recommend a meal for tomorrow's dinner\" is NOT an appropriate use of create_meal_plan. " +
        "Instead, recommend a meal using your own knowledge or the search_library tool, and then log it with log_food.",
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

export const MEAL_PLAN_TOOLS: AiToolDefinition[] = [createMealPlanTool];
