import * as SecureStore from "expo-secure-store";
import logger from "@/src/utils/logger";
import { nvidiaProvider, NVIDIA_DEFAULT_BASE_URL, NVIDIA_DEFAULT_MODEL } from "./nvidia";
import type {
    AiFoodPayload,
    AiGoalsPayload,
    AiMealPlanEntry,
    AiMealPlanResponse,
    AiProvider,
    AiProviderConfig,
    AiProviderId,
    AiRecipePayload,
    ChatMessage,
    MealPlanPreferences,
} from "./types";

export type { AiProviderConfig, AiProviderId, MealPlanPreferences, AiMealPlanEntry, AiMealPlanResponse } from "./types";

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

// ── Meal plan prompt & validation ─────────────────────────
export function buildMealPlanPrompt(
    foods: AiFoodPayload[],
    recipes: AiRecipePayload[],
    goals: AiGoalsPayload,
    prefs: MealPlanPreferences,
): ChatMessage[] {
    const system: ChatMessage = {
        role: "system",
        content: [
            "You are a meal planning assistant. You generate structured meal plans in JSON format.",
            "You MUST only use food IDs from the provided list.",
            "All quantities are in grams (the base unit).",
            "The daily macros should closely match the targets (±10% tolerance).",
            "Respond with ONLY valid JSON matching the schema below. No markdown, no explanation.",
            "",
            "Response schema:",
            '{ "entries": [ { "date": "YYYY-MM-DD", "meal_type": "breakfast"|"lunch"|"dinner"|"snack", "food_id": <number>, "quantity_grams": <number> } ] }',
        ].join("\n"),
    };

    const userContent = [
        `Generate a ${prefs.days}-day meal plan.`,
        "",
        "=== Daily macro targets ===",
        `Calories: ${goals.calories} kcal`,
        `Protein: ${goals.protein} g`,
        `Carbs: ${goals.carbs} g`,
        `Fat: ${goals.fat} g`,
        "",
        "=== Available foods ===",
        JSON.stringify(foods),
        "",
    ];

    if (recipes.length > 0) {
        userContent.push("=== Available recipes ===", JSON.stringify(recipes), "");
    }

    if (prefs.likedFoods.trim()) {
        userContent.push(`Foods I like: ${prefs.likedFoods}`);
    }
    if (prefs.dislikedFoods.trim()) {
        userContent.push(`Foods I don't like: ${prefs.dislikedFoods}`);
    }

    const user: ChatMessage = { role: "user", content: userContent.join("\n") };

    return [system, user];
}

/** Parse and validate the AI response into a meal plan. */
export function parseMealPlanResponse(
    raw: string,
    validFoodIds: Set<number>,
    goals: AiGoalsPayload,
    foods: AiFoodPayload[],
): AiMealPlanResponse {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        throw new Error("AI response is not valid JSON");
    }

    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).entries)) {
        throw new Error("AI response missing 'entries' array");
    }

    const entries: AiMealPlanEntry[] = [];
    const validMeals = new Set(["breakfast", "lunch", "dinner", "snack"]);
    const foodMap = new Map(foods.map((f) => [f.id, f]));

    for (const e of (parsed as any).entries) {
        if (!e.date || !e.meal_type || e.food_id == null || e.quantity_grams == null) {
            throw new Error("Entry missing required fields");
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
            throw new Error(`Invalid date format: ${e.date}`);
        }
        if (!validMeals.has(e.meal_type)) {
            throw new Error(`Invalid meal_type: ${e.meal_type}`);
        }
        if (!validFoodIds.has(e.food_id)) {
            throw new Error(`Unknown food_id: ${e.food_id}`);
        }
        if (typeof e.quantity_grams !== "number" || e.quantity_grams <= 0) {
            throw new Error(`Invalid quantity_grams for food_id ${e.food_id}`);
        }
        entries.push({
            date: e.date,
            meal_type: e.meal_type,
            food_id: e.food_id,
            quantity_grams: e.quantity_grams,
        });
    }

    // Validate daily totals within tolerance
    const dailyTotals = new Map<string, { cal: number; p: number; c: number; f: number }>();
    for (const entry of entries) {
        const food = foodMap.get(entry.food_id);
        if (!food) continue;
        const factor = entry.quantity_grams / 100;
        const day = dailyTotals.get(entry.date) ?? { cal: 0, p: 0, c: 0, f: 0 };
        day.cal += food.calories_per_100g * factor;
        day.p += food.protein_per_100g * factor;
        day.c += food.carbs_per_100g * factor;
        day.f += food.fat_per_100g * factor;
        dailyTotals.set(entry.date, day);
    }

    const TOLERANCE = 0.15; // 15% tolerance
    for (const [date, totals] of dailyTotals) {
        if (Math.abs(totals.cal - goals.calories) / goals.calories > TOLERANCE) {
            logger.warn("[AI] Calorie mismatch", { date, got: Math.round(totals.cal), target: goals.calories });
        }
    }

    return { entries };
}
