/** Supported AI provider identifiers. */
export type AiProviderId = "nvidia";

/** Configuration needed to connect to an AI provider. */
export interface AiProviderConfig {
    provider: AiProviderId;
    apiKey: string;
    baseUrl: string;
    model: string;
}

/** User preferences for meal plan generation. */
export interface MealPlanPreferences {
    likedFoods: string;
    dislikedFoods: string;
    days: number;
}

/** Simplified food payload sent to the AI model. */
export interface AiFoodPayload {
    id: number;
    name: string;
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
    default_unit: string;
    serving_size: number;
}

/** Simplified recipe payload sent to the AI model. */
export interface AiRecipePayload {
    id: number;
    name: string;
    items: { food_id: number; quantity_grams: number }[];
}

/** Macro targets sent to the AI model. */
export interface AiGoalsPayload {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

/** A single meal entry in the AI-generated plan. */
export interface AiMealPlanEntry {
    date: string;
    meal_type: "breakfast" | "lunch" | "dinner" | "snack";
    food_id: number;
    quantity_grams: number;
}

/** The full meal plan returned by the AI. */
export interface AiMealPlanResponse {
    entries: AiMealPlanEntry[];
}

// ── AI status types ───────────────────────────────────────

/** Status phases during streaming generation. */
export type StreamStatus = "connecting" | "thinking" | "generating" | "refining" | "done";
