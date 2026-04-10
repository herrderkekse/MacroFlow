import logger from "@/src/utils/logger";
import type { CoreMessage, LanguageModel } from "ai";
import { streamText } from "ai";
import type { UiChatMessage } from "../types/chatTypes";
import type { AiCallResult, AiProviderConfig } from "../types/types";
import { buildToolSystemPrompt, toAiSdkTools } from "./tools";


export async function callAi(
    config: AiProviderConfig,
    messages: CoreMessage[],
    opts: { onStreamStatus?: (s: string) => void; onStreamToken?: (t: string) => void; signal?: AbortSignal },
    model: LanguageModel
): Promise<AiCallResult> {
    const tools = toAiSdkTools();

    opts.onStreamStatus?.("connecting");

    // console.log("API messages:", JSON.stringify(messages));
    logger.info("Sending messages to AI", { provider: config.provider, model: config.model, messageCount: messages.length });

    const result = streamText({
        model,
        messages,
        tools,
        abortSignal: opts.signal,
    });

    let accumulated = "";
    for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
            accumulated += part.text;
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
            toolCall: { name: tc.toolName, arguments: tc.input as Record<string, unknown> },
            toolCallId: tc.toolCallId,
        };
    }

    return { text: accumulated };
}

/** Format tool result content for the AI, including data payload. */
export function formatToolResultForAi(msg: UiChatMessage): string {
    const summary = msg.content;
    const data = msg.toolResult?.data;
    if (data != null) {
        return `${summary}\n${JSON.stringify(data)}`;
    }
    return summary;
}

/** Convert UI messages to AI SDK CoreMessage array. */
export function toApiMessages(uiMessages: UiChatMessage[]): CoreMessage[] {
    const systemMsg: CoreMessage = {
        role: "system",
        content: buildToolSystemPrompt(),
    };

    const history: CoreMessage[] = [];
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
                        content: [{
                            type: "tool-call",
                            toolCallId: m.toolCallId,
                            toolName: m.toolCall.name,
                            input: m.toolCall.arguments,
                        }],
                    });
                } else {
                    history.push({ role: "assistant", content: `I want to use the tool: ${m.toolCall?.name}` });
                }
                break;
            case "tool-result":
                if (m.toolCallId && m.toolCall) {
                    const prev = history[history.length - 1];
                    const hasPrecedingToolCall = prev?.role === "assistant" && Array.isArray(prev.content);
                    if (!hasPrecedingToolCall) {
                        history.push({
                            role: "assistant",
                            content: [{
                                type: "tool-call",
                                toolCallId: m.toolCallId,
                                toolName: m.toolCall.name,
                                input: m.toolCall.arguments,
                            }],
                        });
                    }
                    history.push({
                        role: "tool",
                        content: [{
                            type: "tool-result",
                            toolCallId: m.toolCallId,
                            toolName: m.toolCall.name,
                            output: { type: "text", value: formatToolResultForAi(m) },
                        }],
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
