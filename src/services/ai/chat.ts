import { getProvider, loadAiConfig, parseMealPlanResponse, parsePartialEntries } from "./index";
import { buildNativeToolSystemPrompt, buildToolSystemPrompt, executeTool, parseToolCall, toOpenAiTools, toolNeedsApproval } from "./tools";
import type { AiChatResponse, AiProviderConfig, AiMealPlanEntry, ChatMessage, StreamCallbacks } from "./types";
import type { AiToolCall, AiToolResult } from "./tools";

// ── Chat message types for the UI ─────────────────────────

export type ChatRole = "user" | "assistant" | "tool-request" | "tool-result";

export interface ToolResultData {
    mealPlanEntries?: AiMealPlanEntry[];
    imported?: boolean;
    dismissed?: boolean;
}

export interface UiChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    /** For tool-request messages, the parsed tool call */
    toolCall?: AiToolCall;
    /** For tool-result messages, the result */
    toolResult?: AiToolResult;
    /** Structured data for tool result UI (e.g. meal plan entries) */
    toolResultData?: ToolResultData;
    /** Native tool_call ID from the API (used to build proper tool role messages) */
    toolCallId?: string;
    /** Timestamp */
    timestamp: number;
}

// ── Chat orchestrator ─────────────────────────────────────

interface ChatSendOptions {
    messages: UiChatMessage[];
    userText: string;
    onMessage: (msg: UiChatMessage) => void;
    onStreamStatus?: (status: string) => void;
    onStreamToken?: (accumulated: string) => void;
    onStreamingToolData?: (data: ToolResultData) => void;
    signal?: AbortSignal;
}

interface ToolApprovalOptions {
    messages: UiChatMessage[];
    toolCall: AiToolCall;
    onMessage: (msg: UiChatMessage) => void;
    onStreamStatus?: (status: string) => void;
    onStreamToken?: (accumulated: string) => void;
    onStreamingToolData?: (data: ToolResultData) => void;
    signal?: AbortSignal;
    /** Native tool_call ID if this approval came from native tool calling */
    toolCallId?: string;
}

let msgCounter = 0;
function nextId(): string {
    return `msg_${Date.now()}_${++msgCounter}`;
}

/** Format tool result content for the AI, including data payload. */
function formatToolResultForAi(msg: UiChatMessage): string {
    const summary = msg.content;
    const data = msg.toolResult?.data;
    if (data != null) {
        return `${summary}\n${JSON.stringify(data)}`;
    }
    return summary;
}

/** Convert UI messages to API-compatible ChatMessage array for prompt-based (fallback) tool calling. */
function toFallbackApiMessages(uiMessages: UiChatMessage[]): ChatMessage[] {
    const systemMsg: ChatMessage = {
        role: "system",
        content: buildToolSystemPrompt(),
    };

    const history: ChatMessage[] = uiMessages.map((m) => {
        switch (m.role) {
            case "user":
                return { role: "user" as const, content: m.content };
            case "assistant":
                return { role: "assistant" as const, content: m.content };
            case "tool-request":
                return {
                    role: "assistant" as const,
                    content: `I want to use the tool: ${m.toolCall?.name}`,
                };
            case "tool-result":
                return {
                    role: "user" as const,
                    content: `Tool result: ${formatToolResultForAi(m)}`,
                };
            default:
                return { role: "user" as const, content: m.content };
        }
    });

    return [systemMsg, ...history];
}

/** Convert UI messages to API-compatible ChatMessage array for native tool calling. */
function toNativeApiMessages(uiMessages: UiChatMessage[]): ChatMessage[] {
    const systemMsg: ChatMessage = {
        role: "system",
        content: buildNativeToolSystemPrompt(),
    };

    const history: ChatMessage[] = [];
    for (const m of uiMessages) {
        switch (m.role) {
            case "user":
                history.push({ role: "user", content: m.content });
                break;
            case "assistant":
                history.push({ role: "assistant", content: m.content });
                break;
            case "tool-request":
                // Represent as an assistant message with tool_calls (OpenAI format)
                if (m.toolCallId && m.toolCall) {
                    history.push({
                        role: "assistant",
                        content: "",
                        tool_calls: [{
                            id: m.toolCallId,
                            type: "function",
                            function: {
                                name: m.toolCall.name,
                                arguments: JSON.stringify(m.toolCall.arguments),
                            },
                        }],
                    });
                } else {
                    history.push({ role: "assistant", content: `I want to use the tool: ${m.toolCall?.name}` });
                }
                break;
            case "tool-result":
                // Use the tool role with tool_call_id if available (native), otherwise fall back
                if (m.toolCallId) {
                    // Ensure there's a preceding assistant(tool_calls) message.
                    // Auto-executed tools don't emit a tool-request to the UI, so we
                    // synthesize the required assistant message from the stored toolCall.
                    const prev = history[history.length - 1];
                    const hasPrecedingToolCalls = prev?.role === "assistant" && "tool_calls" in prev;
                    if (!hasPrecedingToolCalls && m.toolCall) {
                        history.push({
                            role: "assistant",
                            content: "",
                            tool_calls: [{
                                id: m.toolCallId,
                                type: "function",
                                function: {
                                    name: m.toolCall.name,
                                    arguments: JSON.stringify(m.toolCall.arguments),
                                },
                            }],
                        });
                    }
                    history.push({
                        role: "tool",
                        content: formatToolResultForAi(m),
                        tool_call_id: m.toolCallId,
                    });
                } else {
                    history.push({ role: "user", content: `Tool result: ${formatToolResultForAi(m)}` });
                }
                break;
            default:
                history.push({ role: "user", content: m.content });
        }
    }

    return [systemMsg, ...history];
}

/** Extract an AiToolCall from an AiChatResponse if it's a tool_call. */
function responseToToolCall(response: AiChatResponse): (AiToolCall & { toolCallId?: string }) | null {
    if (response.type !== "tool_call") return null;
    return {
        name: response.name,
        arguments: response.arguments,
        toolCallId: response.id,
    };
}

/** Send a user message and get the AI response. May trigger a tool call. */
export async function sendChatMessage(opts: ChatSendOptions): Promise<void> {
    const config = await loadAiConfig();
    if (!config?.apiKey) {
        throw new Error("AI not configured");
    }

    // Add user message first
    const userMsg: UiChatMessage = {
        id: nextId(),
        role: "user",
        content: opts.userText,
        timestamp: Date.now(),
    };
    opts.onMessage(userMsg);

    // Build API messages from history + new user message
    const allMessages = [...opts.messages, userMsg];
    const provider = getProvider(config.provider);
    const useNative = !!provider.supportsToolCalling;
    const apiMessages = useNative ? toNativeApiMessages(allMessages) : toFallbackApiMessages(allMessages);

    // Call the AI (with tools if supported)
    const response = await callAi(config, apiMessages, opts, useNative);

    // Check if the AI wants to call a tool
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

        // Auto-execute tools that don't need approval
        const result = executeTool(toolCall);

        // For native tool calling, the API requires an assistant message with tool_calls
        // before the tool result. Create a synthetic tool-request (not shown in UI).
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

        // Feed result back to AI for a follow-up response
        const allMessagesWithResult = [...allMessages, syntheticToolRequest, toolResultMsg];
        const apiMessagesWithResult = useNative
            ? toNativeApiMessages(allMessagesWithResult)
            : toFallbackApiMessages(allMessagesWithResult);
        const followUp = await callAi(config, apiMessagesWithResult, opts, useNative);

        // The follow-up may itself contain another tool call
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

            // Chain auto-execute for another non-approval tool
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

    // Regular text response
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

    // Execute the tool
    const result = executeTool(toolCall);

    // Special handling for meal plan tool: generate plan, return entries for UI preview
    if (toolCall.name === "create_meal_plan" && result.success && result.data) {
        const planData = result.data as {
            type: string;
            messages: ChatMessage[];
            validFoodIds: number[];
            goals: any;
            foods: any;
        };

        if (planData.type === "meal_plan_request") {
            const validIds = new Set(planData.validFoodIds);

            // Make a separate AI call WITHOUT tools (expects pure JSON output)
            const planResponse = await callAiRaw(config, planData.messages, {
                ...opts,
                onStreamToken: (accumulated) => {
                    // Parse partial entries and forward to UI for live preview
                    const partial = parsePartialEntries(accumulated, validIds);
                    if (partial.length > 0) {
                        opts.onStreamingToolData?.({ mealPlanEntries: partial });
                    }
                },
            });

            try {
                const plan = parseMealPlanResponse(planResponse, validIds, planData.goals, planData.foods);

                // Return entries as data so the UI can preview before importing
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

    // For other tools or failed meal plan prep
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

    // Feed result back to AI for a follow-up response
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

/**
 * Call the AI with optional tool support. Returns a structured AiChatResponse.
 * - Native: passes tools to the API, returns structured tool_call or text.
 * - Fallback: uses prompt-based system message, parses text for tool calls.
 */
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

        // For fallback mode, check if the text response contains a tool call
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

    // For fallback mode, check if the text response contains a tool call
    if (!useNativeTools && response.type === "text") {
        const parsed = parseToolCall(response.content);
        if (parsed) {
            return { type: "tool_call", id: `fallback_${Date.now()}`, name: parsed.name, arguments: parsed.arguments };
        }
    }
    return response;
}

/**
 * Call the AI and return raw text only (no tool support).
 * Used for secondary calls like meal plan generation that expect pure text/JSON output.
 */
async function callAiRaw(
    config: AiProviderConfig,
    messages: ChatMessage[],
    opts: { onStreamStatus?: (s: string) => void; onStreamToken?: (t: string) => void; signal?: AbortSignal },
): Promise<string> {
    const provider = getProvider(config.provider);

    if (provider.supportsStreaming && provider.chatStream) {
        const callbacks: StreamCallbacks = {
            onStatus: (status) => opts.onStreamStatus?.(status),
            onToken: (accumulated) => opts.onStreamToken?.(accumulated),
        };
        const response = await provider.chatStream(config, messages, callbacks, { signal: opts.signal });
        return response.type === "text" ? response.content : "";
    }

    opts.onStreamStatus?.("connecting");
    const response = await provider.chat(config, messages);
    opts.onStreamStatus?.("done");
    return response.type === "text" ? response.content : "";
}
