import logger from "@/src/utils/logger";
import type { AiToolCall, AiToolResult } from "../types/toolDefinitionTypes";
import { entryToolExecutors } from "./toolExecutors/entryToolExecutors";
import { mealPlanToolExecutors } from "./toolExecutors/mealPlanToolExecutors";
import { memoryToolExecutors } from "./toolExecutors/memoryToolExecutors";
import { templateToolExecutors } from "./toolExecutors/templateToolExecutors";

const ALL_TOOL_EXECUTORS: Record<string, (args: Record<string, unknown>) => AiToolResult> = {
    ...mealPlanToolExecutors,
    ...entryToolExecutors,
    ...templateToolExecutors,
    ...memoryToolExecutors,
};

export function executeTool(call: AiToolCall): AiToolResult {
    const executor = ALL_TOOL_EXECUTORS[call.name];
    if (!executor) {
        logger.warn("[AI/Tools] Unknown tool requested", { name: call.name });
        return { success: false, summary: `Unknown tool: ${call.name}` };
    }
    logger.info("[AI/Tools] Executing tool", { name: call.name, args: call.arguments });
    return executor(call.arguments);
}
