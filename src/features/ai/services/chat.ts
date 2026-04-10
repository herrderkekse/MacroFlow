import { streamText } from "ai";
import type { CoreMessage } from "ai";
import type { AiProviderConfig } from "../types";
import { createModelFromConfig, generateMealPlan, loadAiConfig } from "./aiConfig";
import { toApiMessages } from "./chatConverters";
import type { ChatSendOptions, ToolApprovalOptions, UiChatMessage } from "./chatTypes";
import { nextId } from "./chatTypes";
import { executeTool, toAiSdkTools, toolNeedsApproval } from "./tools";

// Re-export types & converters so existing consumers keep working
export { formatToolResultForAi, toApiMessages } from "./chatConverters";
export { nextId } from "./chatTypes";
export type { ChatRole, ChatSendOptions, ToolApprovalOptions, ToolResultData, UiChatMessage } from "./chatTypes";

// ── Internal types ────────────────────────────────────────

interface AiCallResult {
    text: string;
    toolCall?: { name: string; arguments: Record<string, unknown> };
    toolCallId?: string;
}

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

    const response = await callAi(config, apiMessages, opts);

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
        const followUp = await callAi(config, apiMessagesWithResult, opts);

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
            const finalResponse = await callAi(config, apiMessages3, opts);
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
                    onStatus: (status) => opts.onStreamStatus?.(status),
                    onPartialEntries: (entries) => {
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
        toolCallId: opts.toolCallId,
        timestamp: Date.now(),
    };
    opts.onMessage(toolResultMsg);

    if (!result.success) return;

    const allMessages = [...opts.messages, toolResultMsg];
    const apiMessages = toApiMessages(allMessages);

    const followUp = await callAi(config, apiMessages, opts);
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

    const followUp = await callAi(config, apiMessages, opts);
    const followUpMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: followUp.text,
        timestamp: Date.now(),
    };
    opts.onMessage(followUpMsg);
}

// ── Internal helpers ──────────────────────────────────────

async function callAi(
    config: AiProviderConfig,
    messages: CoreMessage[],
    opts: { onStreamStatus?: (s: string) => void; onStreamToken?: (t: string) => void; signal?: AbortSignal },
): Promise<AiCallResult> {
    const model = createModelFromConfig(config);
    const tools = toAiSdkTools();

    opts.onStreamStatus?.("connecting");

    const result = streamText({
        model,
        messages,
        tools,
        abortSignal: opts.signal,
    });

    let accumulated = "";
    for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
            accumulated += part.textDelta;
            opts.onStreamToken?.(accumulated);
            opts.onStreamStatus?.("generating");
        }
    }

    opts.onStreamStatus?.("done");

    const toolCalls = await result.toolCalls;
    if (toolCalls.length > 0) {
        const tc = toolCalls[0];
        return {
            text: accumulated,
            toolCall: { name: tc.toolName, arguments: tc.args as Record<string, unknown> },
            toolCallId: tc.toolCallId,
        };
    }

    return { text: accumulated };
}