import {
    addFood,
    addRecipe,
    addRecipeItem,
    deleteRecipeItem,
    getFoodById,
    getRecipeById,
    getRecipeItemById,
    getRecipeItems,
    getServingUnits,
    searchFoodsByName,
    searchRecipesByName,
    softDeleteFood,
    softDeleteRecipe,
    updateFood,
    updateRecipe,
    type NewFood,
} from "@/src/features/templates/services/templateDb";
import { resolveQuantityToGrams } from "../unitResolution";
import type { AiToolResult } from "../../types/toolDefinitionTypes";

type ToolExecutor = (args: Record<string, unknown>) => AiToolResult;

// ── Library search ────────────────────────────────────────

function executeSearchLibrary(args: Record<string, unknown>): AiToolResult {
    const query = String(args.query ?? "").trim();
    if (!query) return { success: false, summary: "Search query cannot be empty." };

    const matchedFoods = searchFoodsByName(query).map((f) => {
        const servingUnits = getServingUnits(f.id).map((u) => ({ name: u.name, grams: u.grams }));
        return {
            type: "food" as const, id: f.id, name: f.name,
            calories_per_100g: f.calories_per_100g, protein_per_100g: f.protein_per_100g,
            carbs_per_100g: f.carbs_per_100g, fat_per_100g: f.fat_per_100g,
            default_unit: f.default_unit, serving_size: f.serving_size,
            serving_units: servingUnits,
        };
    });
    const matchedRecipes = searchRecipesByName(query).map((r) => ({ type: "recipe" as const, id: r.id, name: r.name }));
    const results = [...matchedFoods, ...matchedRecipes];

    return { success: true, summary: `Found ${matchedFoods.length} food(s) and ${matchedRecipes.length} recipe(s) matching "${query}".`, data: results };
}

// ── Food template executors ───────────────────────────────

function executeCreateFoodTemplate(args: Record<string, unknown>): AiToolResult {
    const name = String(args.name ?? "").trim();
    const caloriesPer100g = Number(args.calories_per_100g);
    const proteinPer100g = Number(args.protein_per_100g);
    const carbsPer100g = Number(args.carbs_per_100g);
    const fatPer100g = Number(args.fat_per_100g);

    if (!name) return { success: false, summary: "Food name cannot be empty." };
    if (isNaN(caloriesPer100g) || caloriesPer100g < 0) return { success: false, summary: "calories_per_100g must be a non-negative number." };
    if (isNaN(proteinPer100g) || proteinPer100g < 0) return { success: false, summary: "protein_per_100g must be a non-negative number." };
    if (isNaN(carbsPer100g) || carbsPer100g < 0) return { success: false, summary: "carbs_per_100g must be a non-negative number." };
    if (isNaN(fatPer100g) || fatPer100g < 0) return { success: false, summary: "fat_per_100g must be a non-negative number." };

    const servingSize = args.serving_size != null ? Number(args.serving_size) : 100;
    const defaultUnit = args.default_unit != null ? String(args.default_unit).trim() : "g";
    if (isNaN(servingSize) || servingSize <= 0) return { success: false, summary: "serving_size must be a positive number." };
    if (!defaultUnit) return { success: false, summary: "default_unit cannot be empty." };

    const food = addFood({
        name, calories_per_100g: caloriesPer100g, protein_per_100g: proteinPer100g,
        carbs_per_100g: carbsPer100g, fat_per_100g: fatPer100g,
        serving_size: servingSize, default_unit: defaultUnit, source: "manual", deleted: 0,
    });

    return {
        success: true,
        summary: `Created food "${food.name}" (id: ${food.id}) with ${caloriesPer100g} kcal, ${proteinPer100g}g protein, ${carbsPer100g}g carbs, ${fatPer100g}g fat per 100g.`,
        data: { food_id: food.id, name: food.name },
    };
}

function executeUpdateFoodTemplate(args: Record<string, unknown>): AiToolResult {
    const foodId = Number(args.food_id);
    if (!foodId || isNaN(foodId)) return { success: false, summary: "Invalid food_id." };

    const food = getFoodById(foodId);
    if (!food) return { success: false, summary: `Food with id ${foodId} not found. Use search_library to find valid food IDs.` };

    const updates: Partial<NewFood> = {};
    if (args.name != null) {
        const name = String(args.name).trim();
        if (!name) return { success: false, summary: "Food name cannot be empty." };
        updates.name = name;
    }
    if (args.calories_per_100g != null) {
        const val = Number(args.calories_per_100g);
        if (isNaN(val) || val < 0) return { success: false, summary: "calories_per_100g must be a non-negative number." };
        updates.calories_per_100g = val;
    }
    if (args.protein_per_100g != null) {
        const val = Number(args.protein_per_100g);
        if (isNaN(val) || val < 0) return { success: false, summary: "protein_per_100g must be a non-negative number." };
        updates.protein_per_100g = val;
    }
    if (args.carbs_per_100g != null) {
        const val = Number(args.carbs_per_100g);
        if (isNaN(val) || val < 0) return { success: false, summary: "carbs_per_100g must be a non-negative number." };
        updates.carbs_per_100g = val;
    }
    if (args.fat_per_100g != null) {
        const val = Number(args.fat_per_100g);
        if (isNaN(val) || val < 0) return { success: false, summary: "fat_per_100g must be a non-negative number." };
        updates.fat_per_100g = val;
    }
    if (args.serving_size != null) {
        const val = Number(args.serving_size);
        if (isNaN(val) || val <= 0) return { success: false, summary: "serving_size must be a positive number." };
        updates.serving_size = val;
    }
    if (args.default_unit != null) {
        const val = String(args.default_unit).trim();
        if (!val) return { success: false, summary: "default_unit cannot be empty." };
        updates.default_unit = val;
    }

    if (Object.keys(updates).length === 0) return { success: false, summary: "No fields to update were provided." };

    updateFood(foodId, updates);
    return {
        success: true,
        summary: `Updated food "${food.name}" (id: ${foodId}).`,
        data: { food_id: foodId, updated_fields: Object.keys(updates) },
    };
}

function executeDeleteFoodTemplate(args: Record<string, unknown>): AiToolResult {
    const foodId = Number(args.food_id);
    if (!foodId || isNaN(foodId)) return { success: false, summary: "Invalid food_id." };

    const food = getFoodById(foodId);
    if (!food) return { success: false, summary: `Food with id ${foodId} not found. Use search_library to find valid food IDs.` };

    softDeleteFood(foodId);
    return {
        success: true,
        summary: `Deleted food "${food.name}" (id: ${foodId}) from the library.`,
        data: { food_id: foodId, name: food.name },
    };
}

// ── Recipe template executors ─────────────────────────────

function executeCreateRecipeTemplate(args: Record<string, unknown>): AiToolResult {
    const name = String(args.name ?? "").trim();
    if (!name) return { success: false, summary: "Recipe name cannot be empty." };

    const recipe = addRecipe(name);
    return {
        success: true,
        summary: `Created recipe "${recipe.name}" (id: ${recipe.id}). Use add_recipe_item to add ingredients.`,
        data: { recipe_id: recipe.id, name: recipe.name },
    };
}

function executeUpdateRecipeTemplate(args: Record<string, unknown>): AiToolResult {
    const recipeId = Number(args.recipe_id);
    const name = String(args.name ?? "").trim();
    if (!recipeId || isNaN(recipeId)) return { success: false, summary: "Invalid recipe_id." };
    if (!name) return { success: false, summary: "Recipe name cannot be empty." };

    const recipe = getRecipeById(recipeId);
    if (!recipe) return { success: false, summary: `Recipe with id ${recipeId} not found. Use search_library to find valid recipe IDs.` };

    updateRecipe(recipeId, name);
    return {
        success: true,
        summary: `Renamed recipe from "${recipe.name}" to "${name}" (id: ${recipeId}).`,
        data: { recipe_id: recipeId, name },
    };
}

function executeDeleteRecipeTemplate(args: Record<string, unknown>): AiToolResult {
    const recipeId = Number(args.recipe_id);
    if (!recipeId || isNaN(recipeId)) return { success: false, summary: "Invalid recipe_id." };

    const recipe = getRecipeById(recipeId);
    if (!recipe) return { success: false, summary: `Recipe with id ${recipeId} not found. Use search_library to find valid recipe IDs.` };

    softDeleteRecipe(recipeId);
    return {
        success: true,
        summary: `Deleted recipe "${recipe.name}" (id: ${recipeId}) from the library.`,
        data: { recipe_id: recipeId, name: recipe.name },
    };
}

function executeReadRecipeTemplate(args: Record<string, unknown>): AiToolResult {
    const recipeId = Number(args.recipe_id);
    if (!recipeId || isNaN(recipeId)) return { success: false, summary: "Invalid recipe_id." };

    const recipe = getRecipeById(recipeId);
    if (!recipe) return { success: false, summary: `Recipe with id ${recipeId} not found. Use search_library to find valid recipe IDs.` };

    const items = getRecipeItems(recipeId).map((row) => ({
        item_id: row.recipe_items.id,
        food_id: row.recipe_items.food_id,
        food_name: row.foods?.name ?? "Unknown",
        quantity_grams: row.recipe_items.quantity_grams,
    }));

    return {
        success: true,
        summary: `Recipe "${recipe.name}" has ${items.length} ingredient(s).`,
        data: { recipe_id: recipe.id, name: recipe.name, items },
    };
}

// ── Recipe item executors ─────────────────────────────────

function executeAddRecipeItem(args: Record<string, unknown>): AiToolResult {
    const recipeId = Number(args.recipe_id);
    const foodId = Number(args.food_id);
    const quantity = Number(args.quantity);

    if (!recipeId || isNaN(recipeId)) return { success: false, summary: "Invalid recipe_id." };
    if (!foodId || isNaN(foodId)) return { success: false, summary: "Invalid food_id." };
    if (!quantity || quantity <= 0) return { success: false, summary: "quantity must be a positive number." };

    const recipe = getRecipeById(recipeId);
    if (!recipe) return { success: false, summary: `Recipe with id ${recipeId} not found. Use search_library to find valid recipe IDs.` };

    const food = getFoodById(foodId);
    if (!food) return { success: false, summary: `Food with id ${foodId} not found. Use search_library to find valid food IDs.` };

    const unit = args.unit != null ? String(args.unit).trim() : food.default_unit;
    const resolved = resolveQuantityToGrams(quantity, unit, foodId);
    if ("error" in resolved) return { success: false, summary: resolved.error };

    const item = addRecipeItem({ recipe_id: recipeId, food_id: foodId, quantity_grams: resolved.grams, quantity_unit: unit });
    return {
        success: true,
        summary: `Added ${quantity} ${unit} of "${food.name}" to recipe "${recipe.name}".`,
        data: { item_id: item.id, recipe_id: recipeId, food_id: foodId, food_name: food.name, quantity, unit },
    };
}

function executeRemoveRecipeItem(args: Record<string, unknown>): AiToolResult {
    const itemId = Number(args.item_id);
    if (!itemId || isNaN(itemId)) return { success: false, summary: "Invalid item_id." };

    const item = getRecipeItemById(itemId);
    if (!item) return { success: false, summary: `Recipe item with id ${itemId} not found. Use read_recipe_template to find valid item IDs.` };

    const food = getFoodById(item.food_id);
    deleteRecipeItem(itemId);
    return {
        success: true,
        summary: `Removed "${food?.name ?? "Unknown"}" (item id: ${itemId}) from the recipe.`,
        data: { item_id: itemId },
    };
}

export const templateToolExecutors: Record<string, ToolExecutor> = {
    search_library: executeSearchLibrary,
    create_food_template: executeCreateFoodTemplate,
    update_food_template: executeUpdateFoodTemplate,
    delete_food_template: executeDeleteFoodTemplate,
    create_recipe_template: executeCreateRecipeTemplate,
    update_recipe_template: executeUpdateRecipeTemplate,
    delete_recipe_template: executeDeleteRecipeTemplate,
    read_recipe_template: executeReadRecipeTemplate,
    add_recipe_item: executeAddRecipeItem,
    remove_recipe_item: executeRemoveRecipeItem,
};
