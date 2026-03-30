import logger from "@/src/utils/logger";
import type { AiProvider, AiProviderConfig, ChatMessage } from "./types";

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";

interface NvidiaChatResponse {
    choices?: { message?: { content?: string } }[];
}

export const nvidiaProvider: AiProvider = {
    id: "nvidia",

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
            throw new Error(`NVIDIA API error (${res.status})`);
        }

        const data: NvidiaChatResponse = await res.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("NVIDIA API returned an empty response");
        }

        return content;
    },
};

export { DEFAULT_BASE_URL as NVIDIA_DEFAULT_BASE_URL, DEFAULT_MODEL as NVIDIA_DEFAULT_MODEL };
