import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const foods = sqliteTable("foods", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    calories_per_100g: real("calories_per_100g").notNull().default(0),
    protein_per_100g: real("protein_per_100g").notNull().default(0),
    carbs_per_100g: real("carbs_per_100g").notNull().default(0),
    fat_per_100g: real("fat_per_100g").notNull().default(0),
    barcode: text("barcode"),
    openfoodfacts_id: text("openfoodfacts_id"),
    source: text("source").notNull().default("manual"),
});

export const entries = sqliteTable("entries", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    food_id: integer("food_id").references(() => foods.id),
    quantity_grams: real("quantity_grams").notNull(),
    timestamp: integer("timestamp").notNull(),
    date: text("date").notNull(),
    meal_type: text("meal_type").notNull(),
    recipe_id: integer("recipe_id"),
    recipe_log_group: text("recipe_log_group"),
});

export const goals = sqliteTable("goals", {
    id: integer("id").primaryKey(),
    calories: real("calories").notNull().default(2000),
    protein: real("protein").notNull().default(150),
    carbs: real("carbs").notNull().default(250),
    fat: real("fat").notNull().default(70),
});

export const recipes = sqliteTable("recipes", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
});

export const recipeItems = sqliteTable("recipe_items", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipe_id: integer("recipe_id").notNull().references(() => recipes.id),
    food_id: integer("food_id").notNull().references(() => foods.id),
    quantity_grams: real("quantity_grams").notNull(),
});
