import * as SecureStore from "expo-secure-store";
import type {
    AiProviderConfig,
    AiProviderId,
} from "../types";
import { PROVIDER_DEFAULTS } from "./providers";

export type { AiFoodPayload, AiMealPlanEntry, AiMealPlanResponse, AiProviderConfig, AiProviderId, MealPlanPreferences, StreamStatus } from "../types";

// Re-export model factory so existing consumers keep working
export { createModelFromConfig } from "./providers";

// Re-export meal plan functions so existing consumers keep working
export {
    buildMealPlanPrompt, buildRefinementMessage,
    generateMealPlan, parseMealPlanResponse, parsePartialEntries, validateMealPlanMacros, type GenerateMealPlanOptions
} from "./mealPlanService";

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
    const defaults = PROVIDER_DEFAULTS[id];
    if (!defaults) throw new Error(`Unknown AI provider: ${id}`);
    return defaults;
}
