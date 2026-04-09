import logger from "@/src/utils/logger";
import type { AiChatResponse, AiProvider, AiProviderConfig, ChatMessage, ChatOptions, StreamCallbacks } from "../types";

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";

interface NvidiaToolCallPart {
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
}

interface NvidiaChatResponse {
    choices?: {
        message?: {
            content?: string | null;
            tool_calls?: NvidiaToolCallPart[];
        };
        finish_reason?: string;
    }[];
}

interface NvidiaStreamChunk {
    choices?: {
        delta?: {
            content?: string | null;
            reasoning_content?: string;
            tool_calls?: NvidiaToolCallPart[];
        };
        finish_reason?: string | null;
    }[];
}

/** Try to extract a human-readable error from the API response body. */
function parseApiError(status: number, body: string): string {
    if (status === 429) {
        try {
            const parsed = JSON.parse(body);
            const msg = parsed?.detail ?? parsed?.error?.message;
            if (msg) return `Rate limited: ${msg}`;
        } catch { /* ignore */ }
        return "Rate limited — please wait a moment and try again.";
    }
    try {
        const parsed = JSON.parse(body);
        const msg = parsed?.detail ?? parsed?.error?.message;
        if (msg) return `NVIDIA API error (${status}): ${msg}`;
    } catch { /* ignore */ }
    return `NVIDIA API error (${status})`;
}

/** Convert a native tool_calls response into an AiChatResponse. */
function toolCallToResponse(tc: NvidiaToolCallPart): AiChatResponse {
    const name = tc.function?.name ?? "";
    const id = tc.id ?? `tc_${Date.now()}`;
    let args: Record<string, unknown> = {};
    try {
        args = JSON.parse(tc.function?.arguments ?? "{}");
    } catch {
        logger.warn("[AI/NVIDIA] Failed to parse tool_call arguments", { raw: tc.function?.arguments });
    }
    return { type: "tool_call", id, name, arguments: args };
}

export const nvidiaProvider: AiProvider = {
    id: "nvidia",
    supportsStreaming: true,
    supportsToolCalling: true,

    async chat(config: AiProviderConfig, messages: ChatMessage[], options?: ChatOptions): Promise<AiChatResponse> {
        const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
        const model = config.model || DEFAULT_MODEL;

        logger.info("[AI/NVIDIA] Sending chat request", { baseUrl, model, hasTools: !!options?.tools });

        const body: Record<string, unknown> = {
            model,
            messages,
            temperature: 0.3,
            max_tokens: 4096,
        };
        if (options?.tools?.length) {
            body.tools = options.tools;
            body.tool_choice = "auto";
        }

        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const respBody = await res.text().catch(() => "");
            logger.error("[AI/NVIDIA] Request failed", { status: res.status, body: respBody });
            throw new Error(parseApiError(res.status, respBody));
        }

        const data: NvidiaChatResponse = await res.json();
        const choice = data.choices?.[0]?.message;

        // Check for native tool calls first
        if (choice?.tool_calls?.length) {
            return toolCallToResponse(choice.tool_calls[0]);
        }

        const content = choice?.content;
        if (!content) {
            throw new Error("NVIDIA API returned an empty response");
        }

        return { type: "text", content };
    },

    async chatStream(
        config: AiProviderConfig,
        messages: ChatMessage[],
        callbacks: StreamCallbacks,
        options?: ChatOptions,
    ): Promise<AiChatResponse> {
        const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
        const model = config.model || DEFAULT_MODEL;

        logger.info("[AI/NVIDIA] Sending streaming chat request", { baseUrl, model, hasTools: !!options?.tools });
        callbacks.onStatus("connecting");

        const body: Record<string, unknown> = {
            model,
            messages,
            temperature: 0.3,
            max_tokens: 4096,
            stream: true,
        };
        if (options?.tools?.length) {
            body.tools = options.tools;
            body.tool_choice = "auto";
        }

        // React Native's fetch doesn't support ReadableStream on res.body,
        // so we use XMLHttpRequest with onprogress for SSE streaming.
        return new Promise<AiChatResponse>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let accumulated = "";
            let processedLength = 0;
            let hasContent = false;
            let settled = false;

            // Accumulate streamed tool_call fragments
            let toolCallId = "";
            let toolCallName = "";
            let toolCallArgs = "";
            let isToolCall = false;

            function settle(fn: () => void) {
                if (!settled) {
                    settled = true;
                    fn();
                }
            }

            const signal = options?.signal;
            if (signal) {
                signal.addEventListener("abort", () => {
                    xhr.abort();
                    const err = new Error("Aborted");
                    err.name = "AbortError";
                    settle(() => reject(err));
                });
            }

            xhr.open("POST", `${baseUrl}/chat/completions`);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader("Authorization", `Bearer ${config.apiKey}`);

            xhr.onreadystatechange = () => {
                // LOADING — process incremental data
                if (xhr.readyState === 3 || xhr.readyState === 4) {
                    const text = xhr.responseText;
                    if (text.length > processedLength) {
                        const newData = text.slice(processedLength);
                        processedLength = text.length;
                        const lines = newData.split("\n");

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith("data: ")) continue;

                            const data = trimmed.slice(6);
                            if (data === "[DONE]") continue;

                            try {
                                const chunk: NvidiaStreamChunk = JSON.parse(data);
                                const delta = chunk.choices?.[0]?.delta;

                                if (delta?.reasoning_content) {
                                    callbacks.onStatus("thinking");
                                    continue;
                                }

                                // Handle streamed tool_calls deltas
                                if (delta?.tool_calls?.length) {
                                    const tc = delta.tool_calls[0];
                                    if (!isToolCall) {
                                        isToolCall = true;
                                        callbacks.onStatus("generating");
                                    }
                                    if (tc.id) toolCallId = tc.id;
                                    if (tc.function?.name) toolCallName += tc.function.name;
                                    if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
                                    continue;
                                }

                                const token = delta?.content;
                                if (token) {
                                    if (!hasContent) {
                                        hasContent = true;
                                        callbacks.onStatus("generating");
                                    }
                                    accumulated += token;
                                    callbacks.onToken(accumulated);
                                }
                            } catch {
                                // Skip malformed chunks
                            }
                        }
                    }
                }
            };

            xhr.onload = () => {
                if (xhr.status !== 200) {
                    const errMsg = parseApiError(xhr.status, xhr.responseText);
                    logger.error("[AI/NVIDIA] Streaming request failed", { status: xhr.status });
                    settle(() => reject(new Error(errMsg)));
                    return;
                }

                // If we accumulated a tool call, return it
                if (isToolCall && toolCallName) {
                    let args: Record<string, unknown> = {};
                    try {
                        args = JSON.parse(toolCallArgs || "{}");
                    } catch {
                        logger.warn("[AI/NVIDIA] Failed to parse streamed tool_call arguments", { raw: toolCallArgs });
                    }
                    callbacks.onStatus("done");
                    settle(() => resolve({
                        type: "tool_call",
                        id: toolCallId || `tc_${Date.now()}`,
                        name: toolCallName,
                        arguments: args,
                    }));
                    return;
                }

                if (!accumulated) {
                    settle(() => reject(new Error("NVIDIA API returned an empty streaming response")));
                    return;
                }

                callbacks.onStatus("done");
                settle(() => resolve({ type: "text", content: accumulated }));
            };

            xhr.onerror = () => {
                logger.error("[AI/NVIDIA] Streaming network error");
                settle(() => reject(new Error("Network error during streaming")));
            };

            xhr.ontimeout = () => {
                settle(() => reject(new Error("Streaming request timed out")));
            };

            callbacks.onStatus("thinking");
            xhr.send(JSON.stringify(body));
        });
    },
};

export { DEFAULT_BASE_URL as NVIDIA_DEFAULT_BASE_URL, DEFAULT_MODEL as NVIDIA_DEFAULT_MODEL };
