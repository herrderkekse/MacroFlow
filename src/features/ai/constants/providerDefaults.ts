import type { AiProviderId } from "../types/types";

// ── Provider defaults ─────────────────────────────────────

export const PROVIDER_DEFAULTS: Record<AiProviderId, { baseUrl: string; model: string }> = {
    nvidia: {
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "meta/llama-3.1-70b-instruct",
    },
    openai: {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.4-mini",
    },
};