import { getProvider, loadAiConfig, parseMealPlanResponse, parsePartialEntries } from "./index";
import { buildToolSystemPrompt, executeTool, parseToolCall, toolNeedsApproval } from "./tools";
import type { AiProviderConfig, AiMealPlanEntry, ChatMessage, StreamCallbacks } from "./types";
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
}

let msgCounter = 0;
function nextId(): string {
    return `msg_${Date.now()}_${++msgCounter}`;
}

/** Convert UI messages to API-compatible ChatMessage array. */
function toApiMessages(uiMessages: UiChatMessage[]): ChatMessage[] {
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
                    content: `Tool result: ${m.content}`,
                };
            default:
                return { role: "user" as const, content: m.content };
        }
    });

    return [systemMsg, ...history];
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
    const apiMessages = toApiMessages(allMessages);

    // Call the AI
    const response = await callAi(config, apiMessages, opts);

    // Check if the AI wants to call a tool
    const toolCall = parseToolCall(response);
    if (toolCall) {
        if (toolNeedsApproval(toolCall.name)) {
            // Emit a tool-request message for the user to approve
            const toolRequestMsg: UiChatMessage = {
                id: nextId(),
                role: "tool-request",
                content: `Wants to use: **${toolCall.name}**`,
                toolCall,
                timestamp: Date.now(),
            };
            opts.onMessage(toolRequestMsg);
            return;
        }

        // Auto-execute tools that don't need approval
        const result = executeTool(toolCall);
        const toolResultMsg: UiChatMessage = {
            id: nextId(),
            role: "tool-result",
            content: result.summary,
            toolResult: result,
            timestamp: Date.now(),
        };
        opts.onMessage(toolResultMsg);

        // Feed result back to AI for a follow-up response
        const allMessagesWithResult = [...allMessages, toolResultMsg];
        const apiMessagesWithResult = toApiMessages(allMessagesWithResult);
        const followUp = await callAi(config, apiMessagesWithResult, opts);

        // The follow-up may itself contain another tool call
        const followUpToolCall = parseToolCall(followUp);
        if (followUpToolCall) {
            if (toolNeedsApproval(followUpToolCall.name)) {
                const toolRequestMsg: UiChatMessage = {
                    id: nextId(),
                    role: "tool-request",
                    content: `Wants to use: **${followUpToolCall.name}**`,
                    toolCall: followUpToolCall,
                    timestamp: Date.now(),
                };
                opts.onMessage(toolRequestMsg);
                return;
            }

            // Chain auto-execute for another non-approval tool
            const result2 = executeTool(followUpToolCall);
            const toolResultMsg2: UiChatMessage = {
                id: nextId(),
                role: "tool-result",
                content: result2.summary,
                toolResult: result2,
                timestamp: Date.now(),
            };
            opts.onMessage(toolResultMsg2);

            const apiMessages3 = toApiMessages([...allMessagesWithResult, toolResultMsg2]);
            const finalResponse = await callAi(config, apiMessages3, opts);
            const finalMsg: UiChatMessage = {
                id: nextId(),
                role: "assistant",
                content: finalResponse,
                timestamp: Date.now(),
            };
            opts.onMessage(finalMsg);
            return;
        }

        const followUpMsg: UiChatMessage = {
            id: nextId(),
            role: "assistant",
            content: followUp,
            timestamp: Date.now(),
        };
        opts.onMessage(followUpMsg);
        return;
    }

    // Regular text response
    const assistantMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: response,
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

            // Make a separate AI call; stream partial entries to the UI
            const planResponse = await callAi(config, planData.messages, {
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
        timestamp: Date.now(),
    };
    opts.onMessage(toolResultMsg);

    if (!result.success) return;

    // Feed result back to AI for a follow-up response
    const allMessages = [...opts.messages, toolResultMsg];
    const apiMessages = toApiMessages(allMessages);

    const followUp = await callAi(config, apiMessages, opts);
    const followUpMsg: UiChatMessage = {
        id: nextId(),
        role: "assistant",
        content: followUp,
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
        content: followUp,
        timestamp: Date.now(),
    };
    opts.onMessage(followUpMsg);
}

// ── Internal helper ───────────────────────────────────────

async function callAi(
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
        return provider.chatStream(config, messages, callbacks, opts.signal);
    }

    opts.onStreamStatus?.("connecting");
    const result = await provider.chat(config, messages);
    opts.onStreamStatus?.("done");
    return result;
}
