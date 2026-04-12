import type { AiToolDefinition } from "../types/toolDefinitionTypes";
import { ENTRY_TOOLS, VALID_MEAL_TYPES } from "./toolDefinitions/entryToolDefinitions";
import { MEAL_PLAN_TOOLS } from "./toolDefinitions/mealPlanToolDefinitions";
import { MEMORY_TOOLS } from "./toolDefinitions/memoryToolDefinitions";
import { TEMPLATE_TOOLS } from "./toolDefinitions/templateToolDefinitions";

export { VALID_MEAL_TYPES };

export const AI_TOOLS: AiToolDefinition[] = [
    ...MEAL_PLAN_TOOLS,
    ...ENTRY_TOOLS,
    ...TEMPLATE_TOOLS,
    ...MEMORY_TOOLS,
];