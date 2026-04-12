import { getGoals } from "@/src/features/settings/services/settingsDb";
import { getAllFoods, getAllRecipes, getRecipeItems } from "@/src/features/templates/services/templateDb";
import type { AiToolResult } from "../../types/toolDefinitionTypes";
import type { AiFoodPayload, AiGoalsPayload, AiRecipePayload } from "../../types/types";
import { buildMealPlanPrompt } from "../mealPlanService";

type ToolExecutor = (args: Record<string, unknown>) => AiToolResult;

function executeCreateMealPlan(args: Record<string, unknown>): AiToolResult {
    const days = Math.max(1, Math.min(7, Number(args.days) || 3));
    const likedFoods = String(args.liked_foods ?? "");
    const dislikedFoods = String(args.disliked_foods ?? "");

    const goals = getGoals();
    if (!goals) return { success: false, summary: "No daily macro goals set. Please configure goals first." };

    const allFoods = getAllFoods();
    if (allFoods.length === 0) return { success: false, summary: "No foods in library. Please add foods first." };

    const foodPayload: AiFoodPayload[] = allFoods.map((f) => ({
        id: f.id, name: f.name, calories_per_100g: f.calories_per_100g,
        protein_per_100g: f.protein_per_100g, carbs_per_100g: f.carbs_per_100g,
        fat_per_100g: f.fat_per_100g, default_unit: f.default_unit, serving_size: f.serving_size,
    }));

    const allRecipes = getAllRecipes();
    const recipePayload: AiRecipePayload[] = allRecipes.map((r) => {
        const items = getRecipeItems(r.id);
        return { id: r.id, name: r.name, items: items.map((i) => ({ food_id: i.recipe_items.food_id, quantity_grams: i.recipe_items.quantity_grams })) };
    });

    const goalsPayload: AiGoalsPayload = { calories: goals.calories, protein: goals.protein, carbs: goals.carbs, fat: goals.fat };
    const messages = buildMealPlanPrompt(foodPayload, recipePayload, goalsPayload, { likedFoods, dislikedFoods, days });

    return {
        success: true,
        summary: `Prepared meal plan request for ${days} day(s).`,
        data: {
            type: "meal_plan_request", messages, validFoodIds: allFoods.map((f) => f.id),
            goals: goalsPayload, foods: foodPayload, recipes: recipePayload,
            prefs: { likedFoods, dislikedFoods, days },
        },
    };
}

export const mealPlanToolExecutors: Record<string, ToolExecutor> = {
    create_meal_plan: executeCreateMealPlan,
};
