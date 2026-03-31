import logger from "@/src/utils/logger";
import type { AiProvider, AiProviderConfig, ChatMessage, StreamCallbacks } from "./types";

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";

interface NvidiaChatResponse {
    choices?: { message?: { content?: string } }[];
}

interface NvidiaStreamChunk {
    choices?: { delta?: { content?: string; reasoning_content?: string } }[];
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

export const nvidiaProvider: AiProvider = {
    id: "nvidia",
    supportsStreaming: true,

    async chat(config: AiProviderConfig, messages: ChatMessage[]): Promise<string> {
        const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
        const model = config.model || DEFAULT_MODEL;

        logger.info("[AI/NVIDIA] Sending chat request", { baseUrl, model });

        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.3,
                max_tokens: 4096,
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            logger.error("[AI/NVIDIA] Request failed", { status: res.status, body });
            throw new Error(parseApiError(res.status, body));
        }

        const data: NvidiaChatResponse = await res.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("NVIDIA API returned an empty response");
        }

        return content;
    },

    async chatStream(
        config: AiProviderConfig,
        messages: ChatMessage[],
        callbacks: StreamCallbacks,
        signal?: AbortSignal,
    ): Promise<string> {
        const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
        const model = config.model || DEFAULT_MODEL;

        logger.info("[AI/NVIDIA] Sending streaming chat request", { baseUrl, model });
        callbacks.onStatus("connecting");

        // React Native's fetch doesn't support ReadableStream on res.body,
        // so we use XMLHttpRequest with onprogress for SSE streaming.
        return new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let accumulated = "";
            let processedLength = 0;
            let hasContent = false;
            let settled = false;

            function settle(fn: () => void) {
                if (!settled) {
                    settled = true;
                    fn();
                }
            }

            if (signal) {
                signal.addEventListener("abort", () => {
                    xhr.abort();
                    settle(() => reject(new DOMException("Aborted", "AbortError")));
                });
            }

            xhr.open("POST", `${baseUrl}/chat/completions`);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader("Authorization", `Bearer ${config.apiKey}`);

            xhr.onreadystatechange = () => {
                // HEADERS_RECEIVED — check status early
                if (xhr.readyState === 2 && xhr.status !== 0 && xhr.status !== 200) {
                    // Let onerror / onload handle the body
                }
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

                if (!accumulated) {
                    settle(() => reject(new Error("NVIDIA API returned an empty streaming response")));
                    return;
                }

                callbacks.onStatus("done");
                settle(() => resolve(accumulated));
            };

            xhr.onerror = () => {
                logger.error("[AI/NVIDIA] Streaming network error");
                settle(() => reject(new Error("Network error during streaming")));
            };

            xhr.ontimeout = () => {
                settle(() => reject(new Error("Streaming request timed out")));
            };

            callbacks.onStatus("thinking");
            xhr.send(JSON.stringify({
                model,
                messages,
                temperature: 0.3,
                max_tokens: 4096,
                stream: true,
            }));
        });
    },
};

export { DEFAULT_BASE_URL as NVIDIA_DEFAULT_BASE_URL, DEFAULT_MODEL as NVIDIA_DEFAULT_MODEL };
