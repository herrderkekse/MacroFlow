import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    default_unit: text("default_unit").notNull().default("g"),
    serving_size: real("serving_size").notNull().default(100),
    last_logged_amount: real("last_logged_amount"),
    last_logged_unit: text("last_logged_unit"),
    last_logged_meal: text("last_logged_meal"),
    deleted: integer("deleted").notNull().default(0),
});

export const recipeLogs = sqliteTable("recipe_logs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipe_id: integer("recipe_id").notNull().references(() => recipes.id),
    date: text("date").notNull(),
    meal_type: text("meal_type").notNull(),
    portion: real("portion").notNull().default(1),
    timestamp: integer("timestamp").notNull(),
});

export const entries = sqliteTable("entries", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    food_id: integer("food_id").references(() => foods.id),
    quantity_grams: real("quantity_grams").notNull(),
    quantity_unit: text("quantity_unit").notNull().default("g"),
    timestamp: integer("timestamp").notNull(),
    date: text("date").notNull(),
    meal_type: text("meal_type").notNull(),
    recipe_log_id: integer("recipe_log_id").references(() => recipeLogs.id),
    is_scheduled: integer("is_scheduled").notNull().default(0),
});

export const goals = sqliteTable("goals", {
    id: integer("id").primaryKey(),
    calories: real("calories").notNull().default(2000),
    protein: real("protein").notNull().default(150),
    carbs: real("carbs").notNull().default(250),
    fat: real("fat").notNull().default(70),
    unit_system: text("unit_system").notNull().default("metric"),
    language: text("language").notNull().default("en"),
    appearance_mode: text("appearance_mode").notNull().default("system"),
    keep_awake: integer("keep_awake").notNull().default(0),
});

export const recipes = sqliteTable("recipes", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    deleted: integer("deleted").notNull().default(0),
});

export const recipeItems = sqliteTable("recipe_items", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipe_id: integer("recipe_id").notNull().references(() => recipes.id),
    food_id: integer("food_id").notNull().references(() => foods.id),
    quantity_grams: real("quantity_grams").notNull(),
    quantity_unit: text("quantity_unit").notNull().default("g"),
});

export const servingUnits = sqliteTable("serving_units", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    food_id: integer("food_id").notNull().references(() => foods.id),
    name: text("name").notNull(),
    grams: real("grams").notNull(),
});

export const weightLogs = sqliteTable("weight_logs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weight_kg: real("weight_kg").notNull(),
    date: text("date").notNull(),
    timestamp: integer("timestamp").notNull(),
});

export const notificationSettings = sqliteTable("notification_settings", {
    id: integer("id").primaryKey(),
    enabled: integer("enabled").notNull().default(0),
    breakfast_time: text("breakfast_time").notNull().default("08:00"),
    lunch_time: text("lunch_time").notNull().default("12:00"),
    dinner_time: text("dinner_time").notNull().default("18:00"),
    snack_time: text("snack_time").notNull().default("15:00"),
    weight_time: text("weight_time").notNull().default("07:30"),
    breakfast_enabled: integer("breakfast_enabled").notNull().default(1),
    lunch_enabled: integer("lunch_enabled").notNull().default(1),
    dinner_enabled: integer("dinner_enabled").notNull().default(1),
    snack_enabled: integer("snack_enabled").notNull().default(1),
    weight_enabled: integer("weight_enabled").notNull().default(1),
});

export const chatSessions = sqliteTable("chat_sessions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull().default("New Chat"),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    session_id: integer("session_id").notNull().references(() => chatSessions.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    tool_call_json: text("tool_call_json"),
    tool_result_json: text("tool_result_json"),
    tool_result_data_json: text("tool_result_data_json"),
    tool_call_id: text("tool_call_id"),
    timestamp: integer("timestamp").notNull(),
});

export const aiMemories = sqliteTable("ai_memories", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    created_at: integer("created_at").notNull(),
});

export const exerciseTemplates = sqliteTable("exercise_templates", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    muscle_group: text("muscle_group"),
    equipment: text("equipment"),
    resistance_mode: text("resistance_mode").notNull().default("resistance"),
    default_weight_unit: text("default_weight_unit").notNull().default("kg"),
    notes: text("notes"),
    deleted: integer("deleted").notNull().default(0),
    created_at: integer("created_at").notNull(),
});

export const workouts = sqliteTable("workouts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    title: text("title"),
    started_at: integer("started_at").notNull(),
    ended_at: integer("ended_at"),
    notes: text("notes"),
    is_scheduled: integer("is_scheduled").notNull().default(0),
});

export const workoutExercises = sqliteTable("workout_exercises", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workout_id: integer("workout_id").notNull().references(() => workouts.id),
    exercise_template_id: integer("exercise_template_id").notNull().references(() => exerciseTemplates.id),
    sort_order: integer("sort_order").notNull(),
    notes: text("notes"),
    started_at: integer("started_at"),
});

export const exerciseSets = sqliteTable("exercise_sets", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workout_exercise_id: integer("workout_exercise_id").notNull().references(() => workoutExercises.id),
    set_order: integer("set_order").notNull(),
    type: text("type").notNull().default("working"),
    weight: real("weight"),
    weight_unit: text("weight_unit").notNull().default("kg"),
    reps: integer("reps"),
    duration_seconds: integer("duration_seconds"),
    distance_meters: real("distance_meters"),
    rir: integer("rir"),
    rest_seconds: integer("rest_seconds"),
    completed_at: integer("completed_at"),
    is_scheduled: integer("is_scheduled").notNull().default(0),
});
