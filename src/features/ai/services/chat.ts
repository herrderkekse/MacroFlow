// Re-export types & converters so existing consumers keep working
export { formatToolResultForAi, responseToToolCall, toFallbackApiMessages, toNativeApiMessages } from "./chatConverters";
export { nextId } from "./chatTypes";
export type { ChatRole, ChatSendOptions, ToolApprovalOptions, ToolResultData, UiChatMessage } from "./chatTypes";

import type { AiChatResponse, AiProviderConfig, ChatMessage, StreamCallbacks } from "../types";
import { generateMealPlan, getProvider, loadAiConfig } from "./aiConfig";
import { responseToToolCall, toFallbackApiMessages, toNativeApiMessages } from "./chatConverters";
import type { ChatSendOptions, ToolApprovalOptions, UiChatMessage } from "./chatTypes";
import { nextId } from "./chatTypes";
import { executeTool, parseToolCall, toOpenAiTools, toolNeedsApproval } from "./tools";

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
    const provider = getProvider(config.provider);
    const useNative = !!provider.supportsToolCalling;
    const apiMessages = useNative ? toNativeApiMessages(allMessages) : toFallbackApiMessages(allMessages);

    const response = await callAi(config, apiMessages, opts, useNative);

    const toolCall = responseToToolCall(response);
    if (toolCall) {
        if (toolNeedsApproval(toolCall.name)) {
            const toolRequestMsg: UiChatMessage = {
                id: nextId(),
                role: "tool-request",
                content: `Wants to use: **${toolCall.name}**`,
                toolCall,
                toolCallId: toolCall.toolCallId,
                timestamp: Date.now(),
            };
            opts.onMessage(toolRequestMsg);
            return;
        }

        const result = executeTool(toolCall);

        const syntheticToolRequest: UiChatMessage = {
            id: nextId(),
            role: "tool-request",
            content: "",
            toolCall,
            toolCallId: toolCall.toolCallId,
            timestamp: Date.now(),
        };

        const toolResultMsg: UiChatMessage = {
            id: nextId(),
            role: "tool-result",
            content: result.summary,
            toolResult: result,
            toolCall,
            toolCallId: toolCall.toolCallId,
            timestamp: Date.now(),
        };
        opts.onMessage(toolResultMsg);

        const allMessagesWithResult = [...allMessages, syntheticToolRequest, toolResultMsg];
        const apiMessagesWithResult = useNative
            ? toNativeApiMessages(allMessagesWithResult)
            : toFallbackApiMessages(allMessagesWithResult);
        const followUp = await callAi(config, apiMessagesWithResult, opts, useNative);

        const followUpToolCall = responseToToolCall(followUp);
        if (followUpToolCall) {
            if (toolNeedsApproval(followUpToolCall.name)) {
                const toolRequestMsg: UiChatMessage = {
                    id: nextId(),
                    role: "tool-request",
                    content: `Wants to use: **${followUpToolCall.name}**`,
                    toolCall: followUpToolCall,
                    toolCallId: followUpToolCall.toolCallId,
                    timestamp: Date.now(),
                };
                opts.onMessage(toolRequestMsg);
                return;
            }

            const result2 = executeTool(followUpToolCall);

            const syntheticToolRequest2: UiChatMessage = {
                id: nextId(),
                role: "tool-request",
                content: "",
                toolCall: followUpToolCall,
                toolCallId: followUpToolCall.toolCallId,
                timestamp: Date.now(),
            };

            const toolResultMsg2: UiChatMessage = {
                id: nextId(),
                role: "tool-result",
                content: result2.summary,
                toolResult: result2,
                toolCall: followUpToolCall,
                toolCallId: followUpToolCall.toolCallId,
                timestamp: Date.now(),
            };
            opts.onMessage(toolResultMsg2);

            const allMessages3 = [...allMessagesWithResult, syntheticToolRequest2, toolResultMsg2];
            const apiMessages3 = useNative
                ? toNativeApiMessages(allMessages3)
                : toFallbackApiMessages(allMessages3);
            const finalResponse = await callAi(config, apiMessages3, opts, useNative);
            const finalContent = finalResponse.type === "text" ? finalResponse.content : "";
            const finalMsg: UiChatMessage = {
                id: nextId(),
                role: "assistant",
                content: finalContent,
                timestamp: Date.now(),
            };
            opts.onMessage(finalMsg);
            return;
        }

        const followUpContent = followUp.type === "text" ? followUp.content : "";
        const followUpMsg: UiChatMessage = {
            id: nextId(),
            role: "assistant",
            content: followUpContent,
            timestamp: Date.now(),
        };
        opts.onMessage(followUpMsg);
        return;
    }

    const textContent = response.type === "text" ? response.content : "";
    const assistantMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: textContent,
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
            messages: ChatMessage[];
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

    const provider = getProvider(config.provider);
    const useNative = !!provider.supportsToolCalling;
    const allMessages = [...opts.messages, toolResultMsg];
    const apiMessages = useNative ? toNativeApiMessages(allMessages) : toFallbackApiMessages(allMessages);

    const followUp = await callAi(config, apiMessages, opts, useNative);
    const followUpContent = followUp.type === "text" ? followUp.content : "";
    const followUpMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: followUpContent,
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

    const provider = getProvider(config.provider);
    const useNative = !!provider.supportsToolCalling;
    const allMessages = [...opts.messages, declineMsg];
    const apiMessages = useNative ? toNativeApiMessages(allMessages) : toFallbackApiMessages(allMessages);
    apiMessages.push({
        role: "user",
        content: "I declined the tool use. Please suggest an alternative or ask what I'd like instead.",
    });

    const followUp = await callAi(config, apiMessages, opts, useNative);
    const followUpContent = followUp.type === "text" ? followUp.content : "";
    const followUpMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: followUpContent,
        timestamp: Date.now(),
    };
    opts.onMessage(followUpMsg);
}

// ── Internal helpers ──────────────────────────────────────

async function callAi(
    config: AiProviderConfig,
    messages: ChatMessage[],
    opts: { onStreamStatus?: (s: string) => void; onStreamToken?: (t: string) => void; signal?: AbortSignal },
    useNativeTools: boolean,
): Promise<AiChatResponse> {
    const provider = getProvider(config.provider);
    const tools = useNativeTools ? toOpenAiTools() : undefined;
    const chatOptions = { tools, signal: opts.signal };

    if (provider.supportsStreaming && provider.chatStream) {
        const callbacks: StreamCallbacks = {
            onStatus: (status) => opts.onStreamStatus?.(status),
            onToken: (accumulated) => opts.onStreamToken?.(accumulated),
        };
        const response = await provider.chatStream(config, messages, callbacks, chatOptions);

        if (!useNativeTools && response.type === "text") {
            const parsed = parseToolCall(response.content);
            if (parsed) {
                return { type: "tool_call", id: `fallback_${Date.now()}`, name: parsed.name, arguments: parsed.arguments };
            }
        }
        return response;
    }

    opts.onStreamStatus?.("connecting");
    const response = await provider.chat(config, messages, chatOptions);
    opts.onStreamStatus?.("done");

    if (!useNativeTools && response.type === "text") {
        const parsed = parseToolCall(response.content);
        if (parsed) {
            return { type: "tool_call", id: `fallback_${Date.now()}`, name: parsed.name, arguments: parsed.arguments };
        }
    }
    return response;
}