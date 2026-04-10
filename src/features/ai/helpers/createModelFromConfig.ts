import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { PROVIDER_DEFAULTS } from "../constants/providerDefaults";
import type { AiProviderConfig } from "../types/types";

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
