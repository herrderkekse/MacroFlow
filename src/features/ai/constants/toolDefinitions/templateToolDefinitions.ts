import type { AiToolDefinition } from "../../types/toolDefinitionTypes";

// ── Library search ────────────────────────────────────────

const searchLibraryTool: AiToolDefinition = {
    name: "search_library",
    description:
        "Search the user's food library and recipes by name. Returns matching foods with their IDs, macros, and serving info. " +
        "Use this to find food_id values before logging food or managing templates. " +
        "It's a simple text inclusion search, so searching for 'chicken' will match 'grilled chicken breast' and 'chicken salad' (if they exist), etc. " +
        "Searching for something like \"dinner\" or \"healthy recipes\" will most likely NOT return relevant results, so DON'T use it for that.",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "Search term to match against food and recipe names." },
        },
        required: ["query"],
    },
};

// ── Food template tools ───────────────────────────────────

const createFoodTemplateTool: AiToolDefinition = {
    name: "create_food_template",
    description:
        "Create a new food item in the user's food library with its nutritional values per 100g. " +
        "Use this when the user asks to add a new food or when suggesting a meal that requires a food not yet in the library.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            name: { type: "string", description: "Name of the food item." },
            calories_per_100g: { type: "number", description: "Calories per 100g." },
            protein_per_100g: { type: "number", description: "Protein in grams per 100g." },
            carbs_per_100g: { type: "number", description: "Carbohydrates in grams per 100g." },
            fat_per_100g: { type: "number", description: "Fat in grams per 100g." },
            serving_size: { type: "number", description: "Default serving size in grams. Defaults to 100 if omitted." },
            default_unit: { type: "string", description: "Default unit label (e.g. \"g\", \"ml\"). Defaults to \"g\" if omitted." },
        },
        required: ["name", "calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g"],
    },
};

const updateFoodTemplateTool: AiToolDefinition = {
    name: "update_food_template",
    description:
        "Update an existing food item's name or nutritional values. " +
        "Use search_library to get the food_id first. Only the provided fields will be changed.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            food_id: { type: "number", description: "The ID of the food to update." },
            name: { type: "string", description: "New name for the food. Omit to keep current." },
            calories_per_100g: { type: "number", description: "New calories per 100g. Omit to keep current." },
            protein_per_100g: { type: "number", description: "New protein per 100g. Omit to keep current." },
            carbs_per_100g: { type: "number", description: "New carbs per 100g. Omit to keep current." },
            fat_per_100g: { type: "number", description: "New fat per 100g. Omit to keep current." },
            serving_size: { type: "number", description: "New default serving size in grams. Omit to keep current." },
            default_unit: { type: "string", description: "New default unit label. Omit to keep current." },
        },
        required: ["food_id"],
    },
};

const deleteFoodTemplateTool: AiToolDefinition = {
    name: "delete_food_template",
    description:
        "Remove a food item from the user's food library. Use search_library to get the food_id first. " +
        "Existing log entries that used this food are not affected.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            food_id: { type: "number", description: "The ID of the food to delete." },
        },
        required: ["food_id"],
    },
};

// ── Recipe template tools ─────────────────────────────────

const createRecipeTemplateTool: AiToolDefinition = {
    name: "create_recipe_template",
    description:
        "Create a new empty recipe in the user's recipe library. " +
        "After creating the recipe, use add_recipe_item to populate it with food ingredients. " +
        "Use search_library to find food_ids before adding items.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            name: { type: "string", description: "Name of the new recipe." },
        },
        required: ["name"],
    },
};

const updateRecipeTemplateTool: AiToolDefinition = {
    name: "update_recipe_template",
    description:
        "Rename an existing recipe. Use search_library to find the recipe_id first.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            recipe_id: { type: "number", description: "The ID of the recipe to rename." },
            name: { type: "string", description: "The new name for the recipe." },
        },
        required: ["recipe_id", "name"],
    },
};

const deleteRecipeTemplateTool: AiToolDefinition = {
    name: "delete_recipe_template",
    description:
        "Remove a recipe and all its ingredient items from the user's recipe library. " +
        "Use search_library to find the recipe_id first.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            recipe_id: { type: "number", description: "The ID of the recipe to delete." },
        },
        required: ["recipe_id"],
    },
};

const readRecipeTemplateTool: AiToolDefinition = {
    name: "read_recipe_template",
    description:
        "Get the full details of a recipe including all its ingredient items and their IDs. " +
        "Use this before add_recipe_item or remove_recipe_item to inspect the current composition.",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: {
            recipe_id: { type: "number", description: "The ID of the recipe to read." },
        },
        required: ["recipe_id"],
    },
};

// ── Recipe item tools ─────────────────────────────────────

const addRecipeItemTool: AiToolDefinition = {
    name: "add_recipe_item",
    description:
        "Add a food ingredient to an existing recipe. " +
        "Use search_library to find the food_id and recipe_id first.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            recipe_id: { type: "number", description: "The ID of the recipe to add the ingredient to." },
            food_id: { type: "number", description: "The ID of the food to add as an ingredient." },
            quantity_grams: { type: "number", description: "The amount of this ingredient in grams." },
        },
        required: ["recipe_id", "food_id", "quantity_grams"],
    },
};

const removeRecipeItemTool: AiToolDefinition = {
    name: "remove_recipe_item",
    description:
        "Remove an ingredient from a recipe. " +
        "Use read_recipe_template first to get the item_id.",
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            item_id: { type: "number", description: "The ID of the recipe item to remove." },
        },
        required: ["item_id"],
    },
};

export const TEMPLATE_TOOLS: AiToolDefinition[] = [
    searchLibraryTool,
    createFoodTemplateTool,
    updateFoodTemplateTool,
    deleteFoodTemplateTool,
    createRecipeTemplateTool,
    updateRecipeTemplateTool,
    deleteRecipeTemplateTool,
    readRecipeTemplateTool,
    addRecipeItemTool,
    removeRecipeItemTool,
];
