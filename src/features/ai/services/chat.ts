import { callAi, toApiMessages } from "../helpers/chat";
import { createModelFromConfig } from "../helpers/createModelFromConfig";
import { toolNeedsApproval } from "../helpers/tools";
import type { ChatSendOptions, ToolApprovalOptions, UiChatMessage } from "../types/chatTypes";
import { nextId } from "../types/chatTypes";
import { AiMealPlanEntry, loadAiConfig, StreamStatus } from "./aiConfig";
import { generateMealPlan } from "./mealPlanService";
import { executeTool } from "./toolExecutors";
export { executeTool } from "./toolExecutors";

// Re-export types & converters so existing consumers keep working
export { formatToolResultForAi, toApiMessages } from "../helpers/chat";
export { nextId } from "../types/chatTypes";
export type { ChatRole, ChatSendOptions, ToolApprovalOptions, ToolResultData, UiChatMessage } from "../types/chatTypes";

// ── Public API ────────────────────────────────────────────

/** Send a user message and get the AI response. May trigger a tool call. */
export async function sendChatMessage(opts: ChatSendOptions): Promise<void> {
    const config = await loadAiConfig();
    if (!config?.apiKey) {
        throw new Error("AI not configured");
    }

    const userMsg: UiChatMessage = {
        id: nextId(),
        role: "user",
        content: opts.userText,
        timestamp: Date.now(),
    };
    opts.onMessage(userMsg);

    const allMessages = [...opts.messages, userMsg];
    const apiMessages = toApiMessages(allMessages);

    const model = createModelFromConfig(config);
    const response = await callAi(config, apiMessages, opts, model);

    if (response.toolCall) {
        if (toolNeedsApproval(response.toolCall.name)) {
            const toolRequestMsg: UiChatMessage = {
                id: nextId(),
                role: "tool-request",
                content: `Wants to use: **${response.toolCall.name}**`,
                toolCall: response.toolCall,
                toolCallId: response.toolCallId,
                timestamp: Date.now(),
            };
            opts.onMessage(toolRequestMsg);
            return;
        }

        const result = executeTool(response.toolCall);

        const syntheticToolRequest: UiChatMessage = {
            id: nextId(),
            role: "tool-request",
            content: "",
            toolCall: response.toolCall,
            toolCallId: response.toolCallId,
            timestamp: Date.now(),
        };

        const toolResultMsg: UiChatMessage = {
            id: nextId(),
            role: "tool-result",
            content: result.summary,
            toolResult: result,
            toolCall: response.toolCall,
            toolCallId: response.toolCallId,
            timestamp: Date.now(),
        };
        opts.onMessage(toolResultMsg);

        const allMessagesWithResult = [...allMessages, syntheticToolRequest, toolResultMsg];
        const apiMessagesWithResult = toApiMessages(allMessagesWithResult);

        const model = createModelFromConfig(config);
        const followUp = await callAi(config, apiMessagesWithResult, opts, model);

        if (followUp.toolCall) {
            if (toolNeedsApproval(followUp.toolCall.name)) {
                const toolRequestMsg: UiChatMessage = {
                    id: nextId(),
                    role: "tool-request",
                    content: `Wants to use: **${followUp.toolCall.name}**`,
                    toolCall: followUp.toolCall,
                    toolCallId: followUp.toolCallId,
                    timestamp: Date.now(),
                };
                opts.onMessage(toolRequestMsg);
                return;
            }

            const result2 = executeTool(followUp.toolCall);

            const syntheticToolRequest2: UiChatMessage = {
                id: nextId(),
                role: "tool-request",
                content: "",
                toolCall: followUp.toolCall,
                toolCallId: followUp.toolCallId,
                timestamp: Date.now(),
            };

            const toolResultMsg2: UiChatMessage = {
                id: nextId(),
                role: "tool-result",
                content: result2.summary,
                toolResult: result2,
                toolCall: followUp.toolCall,
                toolCallId: followUp.toolCallId,
                timestamp: Date.now(),
            };
            opts.onMessage(toolResultMsg2);

            const allMessages3 = [...allMessagesWithResult, syntheticToolRequest2, toolResultMsg2];
            const apiMessages3 = toApiMessages(allMessages3);
            const model = createModelFromConfig(config);
            const finalResponse = await callAi(config, apiMessages3, opts, model);
            const finalMsg: UiChatMessage = {
                id: nextId(),
                role: "assistant",
                content: finalResponse.text,
                timestamp: Date.now(),
            };
            opts.onMessage(finalMsg);
            return;
        }

        const followUpMsg: UiChatMessage = {
            id: nextId(),
            role: "assistant",
            content: followUp.text,
            timestamp: Date.now(),
        };
        opts.onMessage(followUpMsg);
        return;
    }

    const assistantMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: response.text,
        timestamp: Date.now(),
    };
    opts.onMessage(assistantMsg);
}

/** Execute an approved tool call and feed the result back to the AI. */
export async function executeApprovedTool(opts: ToolApprovalOptions): Promise<void> {
    const config = await loadAiConfig();
    if (!config?.apiKey) {
        throw new Error("AI not configured");
    }

    const { toolCall } = opts;
    const result = executeTool(toolCall);

    if (toolCall.name === "create_meal_plan" && result.success && result.data) {
        const planData = result.data as {
            type: string;
            validFoodIds: number[];
            goals: any;
            foods: any;
            recipes: any;
            prefs: any;
        };

        if (planData.type === "meal_plan_request") {
            const validIds = new Set(planData.validFoodIds);

            try {
                const plan = await generateMealPlan({
                    config,
                    foods: planData.foods,
                    recipes: planData.recipes,
                    goals: planData.goals,
                    prefs: planData.prefs,
                    validFoodIds: validIds,
                    onStatus: (status: StreamStatus) => opts.onStreamStatus?.(status),
                    onPartialEntries: (entries: AiMealPlanEntry[]) => {
                        opts.onStreamingToolData?.({ mealPlanEntries: entries });
                    },
                    signal: opts.signal,
                });

                const toolResultMsg: UiChatMessage = {
                    id: nextId(),
                    role: "tool-result",
                    content: `Meal plan generated with ${plan.entries.length} entries. Review below:`,
                    toolResult: { success: true, summary: `${plan.entries.length} entries ready` },
                    toolResultData: { mealPlanEntries: plan.entries },
                    toolCall: opts.toolCall,
                    toolCallId: opts.toolCallId,
                    timestamp: Date.now(),
                };
                opts.onMessage(toolResultMsg);
                return;
            } catch (e: any) {
                const errorMsg: UiChatMessage = {
                    id: nextId(),
                    role: "tool-result",
                    content: `Failed to parse meal plan: ${e.message}`,
                    toolResult: { success: false, summary: e.message },
                    toolCall: opts.toolCall,
                    toolCallId: opts.toolCallId,
                    timestamp: Date.now(),
                };
                opts.onMessage(errorMsg);
                return;
            }
        }
    }

    const toolResultMsg: UiChatMessage = {
        id: nextId(),
        role: "tool-result",
        content: result.summary,
        toolResult: result,
        toolCall: opts.toolCall,
        toolCallId: opts.toolCallId,
        timestamp: Date.now(),
    };
    opts.onMessage(toolResultMsg);

    if (!result.success) return;

    const allMessages = [...opts.messages, toolResultMsg];
    const apiMessages = toApiMessages(allMessages);
    const model = createModelFromConfig(config);

    const followUp = await callAi(config, apiMessages, opts, model);
    const followUpMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: followUp.text,
        timestamp: Date.now(),
    };
    opts.onMessage(followUpMsg);
}

/** Decline a tool call and notify the AI. */
export async function declineToolCall(opts: ToolApprovalOptions): Promise<void> {
    const config = await loadAiConfig();
    if (!config?.apiKey) {
        throw new Error("AI not configured");
    }

    const declineMsg: UiChatMessage = {
        id: nextId(),
        role: "tool-result",
        content: "The user declined this action.",
        toolResult: { success: false, summary: "User declined" },
        toolCall: opts.toolCall,
        toolCallId: opts.toolCallId,
        timestamp: Date.now(),
    };
    opts.onMessage(declineMsg);

    const allMessages = [...opts.messages, declineMsg];
    const apiMessages = toApiMessages(allMessages);
    apiMessages.push({
        role: "user",
        content: "I declined the tool use. Please suggest an alternative or ask what I'd like instead.",
    });

    const model = createModelFromConfig(config);
    const followUp = await callAi(config, apiMessages, opts, model);
    const followUpMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: followUp.text,
        timestamp: Date.now(),
    };
    opts.onMessage(followUpMsg);
}
