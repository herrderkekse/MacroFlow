import type { TFunction } from "i18next";
import type { Food, Recipe, getRecipeItemsByRecipe } from "../services/templateDb";

/** Pure builders for the Library's rows: subtitles and macros, from data loaded once per list. */

export interface TemplateMacros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

/** A recipe variant as its row shows it. */
export interface TemplateVariant {
    recipe: Recipe;
    subtitle: string;
    calories: number | null;
}

/** One recipe's items joined with their foods. */
export type RecipeItemRows = ReturnType<typeof getRecipeItemsByRecipe> extends Map<number, infer R> ? R : never;

export function exerciseSummary(exercise: { type: string | null; muscle_group: string | null }, t: TFunction) {
    const parts: string[] = [];
    if (exercise.type) parts.push(t(`exercise.types.${exercise.type}`));
    if (exercise.muscle_group) {
        const key = exercise.muscle_group === "full_body" ? "fullBody" : exercise.muscle_group;
        parts.push(t(`exercise.muscles.${key}`));
    }
    return parts.join(" · ") || t("templates.exercise");
}

/** Per-serving calories and macros of a recipe, or null while it has no ingredients. */
export function recipeMacros(recipe: Recipe, rows: RecipeItemRows): TemplateMacros | null {
    if (rows.length === 0) return null;
    const servings = Math.max(1, recipe.servings);
    const sum = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const row of rows) {
        const food = row.foods;
        if (!food) continue;
        const factor = row.recipe_items.quantity_grams / 100 / servings;
        sum.calories += food.calories_per_100g * factor;
        sum.protein += food.protein_per_100g * factor;
        sum.carbs += food.carbs_per_100g * factor;
        sum.fat += food.fat_per_100g * factor;
    }
    return sum;
}

/** "2 servings · 3 ingredients" */
export function recipeSummary(recipe: Recipe, rows: RecipeItemRows, t: TFunction) {
    const count = rows.length;
    if (count === 0) return t("templates.noItems");
    return [
        t("templates.servingCount", { count: Math.max(1, recipe.servings) }),
        t("templates.ingredientCount", { count }),
    ].join(" · ");
}

export function foodMacros(food: Food): TemplateMacros {
    return {
        calories: food.calories_per_100g,
        protein: food.protein_per_100g,
        carbs: food.carbs_per_100g,
        fat: food.fat_per_100g,
    };
}
