import type { AiChatResponse, ChatMessage } from "../types";
import type { UiChatMessage } from "./chatTypes";
import type { AiToolCall } from "./toolDefinitions";
import { buildNativeToolSystemPrompt, buildToolSystemPrompt } from "./tools";

/** Format tool result content for the AI, including data payload. */
export function formatToolResultForAi(msg: UiChatMessage): string {
    const summary = msg.content;
    const data = msg.toolResult?.data;
    if (data != null) {
        return `${summary}\n${JSON.stringify(data)}`;
    }
    return summary;
}

/** Convert UI messages to API-compatible ChatMessage array for prompt-based (fallback) tool calling. */
export function toFallbackApiMessages(uiMessages: UiChatMessage[]): ChatMessage[] {
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
export function toNativeApiMessages(uiMessages: UiChatMessage[]): ChatMessage[] {
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
                if (m.toolCallId) {
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
export function responseToToolCall(response: AiChatResponse): (AiToolCall & { toolCallId?: string }) | null {
    if (response.type !== "tool_call") return null;
    return {
        name: response.name,
        arguments: response.arguments,
        toolCallId: response.id,
    };
}
