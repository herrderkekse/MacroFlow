import * as SecureStore from "expo-secure-store";
import type {
    AiProvider,
    AiProviderConfig,
    AiProviderId,
} from "../types";
import { NVIDIA_DEFAULT_BASE_URL, NVIDIA_DEFAULT_MODEL, nvidiaProvider } from "./nvidia";

export type { AiFoodPayload, AiMealPlanEntry, AiMealPlanResponse, AiProviderConfig, AiProviderId, MealPlanPreferences, StreamCallbacks, StreamStatus } from "../types";

// Re-export meal plan functions so existing consumers keep working
export {
    buildMealPlanPrompt, buildRefinementMessage,
    generateMealPlan, parseMealPlanResponse, parsePartialEntries, validateMealPlanMacros, type GenerateMealPlanOptions
} from "./mealPlanService";

// ── Provider registry ─────────────────────────────────────
const providers: Record<AiProviderId, AiProvider> = {
    nvidia: nvidiaProvider,
};

export function getProvider(id: AiProviderId): AiProvider {
    const p = providers[id];
    if (!p) throw new Error(`Unknown AI provider: ${id}`);
    return p;
}

// ── Secure config persistence ─────────────────────────────
const STORE_KEY = "ai_provider_config";

export async function saveAiConfig(config: AiProviderConfig): Promise<void> {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(config));
}

export async function loadAiConfig(): Promise<AiProviderConfig | null> {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AiProviderConfig;
    } catch {
        return null;
    }
}

export async function deleteAiConfig(): Promise<void> {
    await SecureStore.deleteItemAsync(STORE_KEY);
}

// ── Defaults per provider ─────────────────────────────────
export function getProviderDefaults(id: AiProviderId): { baseUrl: string; model: string } {
    switch (id) {
        case "nvidia":
            return { baseUrl: NVIDIA_DEFAULT_BASE_URL, model: NVIDIA_DEFAULT_MODEL };
    }
}
