import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import type { AiProviderConfig, AiProviderId } from "../types";

// ── Provider defaults ─────────────────────────────────────

export const PROVIDER_DEFAULTS: Record<AiProviderId, { baseUrl: string; model: string }> = {
    nvidia: {
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "meta/llama-3.1-70b-instruct",
    },
    openai: {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
    },
};

// ── Model factory ─────────────────────────────────────────

/** Create an AI SDK LanguageModel from the user's provider config. */
export function createModelFromConfig(config: AiProviderConfig): LanguageModel {
    const defaults = PROVIDER_DEFAULTS[config.provider];
    const baseURL = (config.baseUrl || defaults?.baseUrl || "").replace(/\/+$/, "");
    const model = config.model || defaults?.model || "";

    const provider = createOpenAICompatible({
        name: config.provider,
        apiKey: config.apiKey,
        baseURL,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
    });

    return provider(model);
}
