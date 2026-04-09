import { formatDateKey as formatLocalDateKey } from "@/src/utils/date";
import logger from "@/src/utils/logger";
import type {
    AiFoodPayload,
    AiGoalsPayload,
    AiMealPlanEntry,
    AiMealPlanResponse,
    AiProviderConfig,
    AiRecipePayload,
    ChatMessage,
    MealPlanPreferences,
    StreamStatus,
} from "../types";
import { getProvider } from "./aiConfig";

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
            "IMPORTANT: Each day MUST have a unique date and different meals. Vary the foods across days — do NOT repeat the same meals or combinations day after day. Aim for diverse, interesting combinations.",
            "Respond with ONLY valid JSON matching the schema below. No markdown, no explanation.",
            "",
            "Response schema:",
            '{ "entries": [ { "date": "YYYY-MM-DD", "meal_type": "breakfast"|"lunch"|"dinner"|"snack", "food_id": <number>, "quantity_grams": <number> } ] }',
        ].join("\n"),
    };

    const startDate = formatLocalDateKey(new Date());
    const userContent = [
        `Generate a ${prefs.days}-day meal plan starting from ${startDate}.`,
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

export function parsePartialEntries(
    partial: string,
    validFoodIds: Set<number>,
): AiMealPlanEntry[] {
    const arrStart = partial.indexOf('[');
    if (arrStart === -1) return [];

    const validMeals = new Set(["breakfast", "lunch", "dinner", "snack"]);
    const entries: AiMealPlanEntry[] = [];
    let i = arrStart + 1;

    while (i < partial.length) {
        const objStart = partial.indexOf('{', i);
        if (objStart === -1) break;

        let depth = 0;
        let objEnd = -1;
        for (let j = objStart; j < partial.length; j++) {
            if (partial[j] === '{') depth++;
            else if (partial[j] === '}') {
                depth--;
                if (depth === 0) {
                    objEnd = j;
                    break;
                }
            }
        }

        if (objEnd === -1) break;

        try {
            const obj = JSON.parse(partial.slice(objStart, objEnd + 1));
            if (
                obj.date && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) &&
                validMeals.has(obj.meal_type) &&
                validFoodIds.has(obj.food_id) &&
                typeof obj.quantity_grams === "number" && obj.quantity_grams > 0
            ) {
                entries.push({
                    date: obj.date,
                    meal_type: obj.meal_type,
                    food_id: obj.food_id,
                    quantity_grams: obj.quantity_grams,
                });
            }
        } catch {
            // Malformed object fragment, skip
        }

        i = objEnd + 1;
    }

    return entries;
}

export function parseMealPlanResponse(
    raw: string,
    validFoodIds: Set<number>,
    goals: AiGoalsPayload,
    foods: AiFoodPayload[],
): AiMealPlanResponse {
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

    const TOLERANCE = 0.15;
    for (const [date, totals] of dailyTotals) {
        if (Math.abs(totals.cal - goals.calories) / goals.calories > TOLERANCE) {
            logger.warn("[AI] Calorie mismatch", { date, got: Math.round(totals.cal), target: goals.calories });
        }
    }

    return { entries };
}

export function validateMealPlanMacros(
    entries: AiMealPlanEntry[],
    goals: AiGoalsPayload,
    foods: AiFoodPayload[],
    tolerance = 0.15,
): { isValid: boolean; issues: string[] } {
    const foodMap = new Map(foods.map((f) => [f.id, f]));
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

    const issues: string[] = [];
    for (const [date, totals] of dailyTotals) {
        const dayIssues: string[] = [];
        if (goals.calories > 0 && Math.abs(totals.cal - goals.calories) / goals.calories > tolerance) {
            dayIssues.push(`calories: got ${Math.round(totals.cal)} kcal, target ${goals.calories} kcal`);
        }
        if (goals.protein > 0 && Math.abs(totals.p - goals.protein) / goals.protein > tolerance) {
            dayIssues.push(`protein: got ${Math.round(totals.p)}g, target ${goals.protein}g`);
        }
        if (goals.carbs > 0 && Math.abs(totals.c - goals.carbs) / goals.carbs > tolerance) {
            dayIssues.push(`carbs: got ${Math.round(totals.c)}g, target ${goals.carbs}g`);
        }
        if (goals.fat > 0 && Math.abs(totals.f - goals.fat) / goals.fat > tolerance) {
            dayIssues.push(`fat: got ${Math.round(totals.f)}g, target ${goals.fat}g`);
        }
        if (dayIssues.length > 0) {
            issues.push(`${date}: ${dayIssues.join(", ")}`);
        }
    }

    return { isValid: issues.length === 0, issues };
}

export function buildRefinementMessage(
    previousResponse: string,
    issues: string[],
): ChatMessage {
    return {
        role: "user",
        content: [
            "Your previous meal plan has macro mismatches. Please fix the following issues by adjusting quantities or swapping foods:",
            "",
            ...issues,
            "",
            "Return the COMPLETE corrected meal plan in the same JSON format. Respond with ONLY valid JSON, no explanation.",
        ].join("\n"),
    };
}

// ── High-level meal plan generation with refinement ───────

const MAX_REFINEMENTS = 2;

export interface GenerateMealPlanOptions {
    config: AiProviderConfig;
    foods: AiFoodPayload[];
    recipes: AiRecipePayload[];
    goals: AiGoalsPayload;
    prefs: MealPlanPreferences;
    validFoodIds: Set<number>;
    onStatus?: (status: StreamStatus) => void;
    onPartialEntries?: (entries: AiMealPlanEntry[]) => void;
    signal?: AbortSignal;
}

export async function generateMealPlan(opts: GenerateMealPlanOptions): Promise<AiMealPlanResponse> {
    const { config, foods, recipes, goals, prefs, validFoodIds, onStatus, onPartialEntries, signal } = opts;

    const messages = buildMealPlanPrompt(foods, recipes, goals, prefs);
    const provider = getProvider(config.provider);

    let raw: string;
    if (provider.supportsStreaming && provider.chatStream) {
        const response = await provider.chatStream(
            config,
            messages,
            {
                onStatus: (status) => onStatus?.(status),
                onToken: (accumulated) => {
                    const partial = parsePartialEntries(accumulated, validFoodIds);
                    if (partial.length > 0) onPartialEntries?.(partial);
                },
            },
            { signal },
        );
        raw = response.type === "text" ? response.content : "";
    } else {
        onStatus?.("connecting");
        const response = await provider.chat(config, messages);
        raw = response.type === "text" ? response.content : "";
    }

    let plan = parseMealPlanResponse(raw, validFoodIds, goals, foods);
    onPartialEntries?.(plan.entries);

    const conversationHistory: ChatMessage[] = [...messages, { role: "assistant", content: raw }];

    for (let i = 0; i < MAX_REFINEMENTS; i++) {
        if (signal?.aborted) break;

        const validation = validateMealPlanMacros(plan.entries, goals, foods);
        if (validation.isValid) break;

        logger.info("[AI] Meal plan refinement round", { round: i + 1, issues: validation.issues.length });
        onStatus?.("refining");

        const refinementMsg = buildRefinementMessage(raw, validation.issues);
        conversationHistory.push(refinementMsg);

        let refinedRaw: string;
        if (provider.supportsStreaming && provider.chatStream) {
            const response = await provider.chatStream(
                config,
                conversationHistory,
                {
                    onStatus: () => onStatus?.("refining"),
                    onToken: (accumulated) => {
                        const partial = parsePartialEntries(accumulated, validFoodIds);
                        if (partial.length > 0) onPartialEntries?.(partial);
                    },
                },
                { signal },
            );
            refinedRaw = response.type === "text" ? response.content : "";
        } else {
            const response = await provider.chat(config, conversationHistory);
            refinedRaw = response.type === "text" ? response.content : "";
        }

        try {
            const refinedPlan = parseMealPlanResponse(refinedRaw, validFoodIds, goals, foods);
            plan = refinedPlan;
            raw = refinedRaw;
            conversationHistory.push({ role: "assistant", content: refinedRaw });
            onPartialEntries?.(plan.entries);
        } catch {
            logger.warn("[AI] Refinement parse failed, keeping previous result", { round: i + 1 });
            break;
        }
    }

    return plan;
}
