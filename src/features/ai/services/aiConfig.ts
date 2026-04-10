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

// ── Per-provider settings type ────────────────────────────
export type ProviderSettings = { apiKey: string; baseUrl: string; model: string };

// ── Storage keys ──────────────────────────────────────────
/** Legacy key kept only for one-time migration. */
const LEGACY_STORE_KEY = "ai_provider_config";
const ACTIVE_PROVIDER_KEY = "ai_active_provider";

function configKeyFor(id: AiProviderId): string {
    return `ai_config_${id}`;
}

// ── Per-provider CRUD ─────────────────────────────────────

export async function saveProviderSettings(id: AiProviderId, settings: ProviderSettings): Promise<void> {
    await SecureStore.setItemAsync(configKeyFor(id), JSON.stringify(settings));
}

export async function loadProviderSettings(id: AiProviderId): Promise<ProviderSettings | null> {
    const raw = await SecureStore.getItemAsync(configKeyFor(id));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as ProviderSettings;
    } catch {
        return null;
    }
}

export async function deleteProviderSettings(id: AiProviderId): Promise<void> {
    await SecureStore.deleteItemAsync(configKeyFor(id));
}

export async function loadActiveProvider(): Promise<AiProviderId> {
    const raw = await SecureStore.getItemAsync(ACTIVE_PROVIDER_KEY);
    return (raw as AiProviderId | null) ?? "nvidia";
}

export async function saveActiveProvider(id: AiProviderId): Promise<void> {
    await SecureStore.setItemAsync(ACTIVE_PROVIDER_KEY, id);
}

// ── Aggregate helpers (backward-compatible) ───────────────

/** Save a full provider config and mark it as active. */
export async function saveAiConfig(config: AiProviderConfig): Promise<void> {
    const { provider, ...settings } = config;
    await saveProviderSettings(provider, settings);
    await saveActiveProvider(provider);
}

/**
 * Load the active provider's config.
 * Migrates the legacy single-key format on first call.
 */
export async function loadAiConfig(): Promise<AiProviderConfig | null> {
    const active = await loadActiveProvider();
    const settings = await loadProviderSettings(active);
    if (settings) return { provider: active, ...settings };

    // One-time migration from old single-key storage
    const raw = await SecureStore.getItemAsync(LEGACY_STORE_KEY);
    if (!raw) return null;
    try {
        const legacy = JSON.parse(raw) as AiProviderConfig;
        await saveProviderSettings(legacy.provider, { apiKey: legacy.apiKey, baseUrl: legacy.baseUrl, model: legacy.model });
        await saveActiveProvider(legacy.provider);
        await SecureStore.deleteItemAsync(LEGACY_STORE_KEY);
        return legacy;
    } catch {
        return null;
    }
}

/** Delete the active provider's saved config. */
export async function deleteAiConfig(): Promise<void> {
    const active = await loadActiveProvider();
    await deleteProviderSettings(active);
}

// ── Defaults per provider ─────────────────────────────────
export function getProviderDefaults(id: AiProviderId): { baseUrl: string; model: string } {
    const defaults = PROVIDER_DEFAULTS[id];
    if (!defaults) throw new Error(`Unknown AI provider: ${id}`);
    return defaults;
}
