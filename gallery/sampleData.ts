// Made-up sample data for the screen gallery (web only, see gallery/README.md).
//
// Seeded into each gallery frame's own in-memory database right after
// initDB(), so ids are deterministic (1, 2, 3, … in insertion order) and
// gallery/index.html can link to e.g. the second recipe by id. Dates are
// relative to today so the log and trends always have something to show.
//
// Inserts are async on purpose: on web every *sync* expo-sqlite call allocates
// a 1 MB SharedArrayBuffer, and a few hundred of those per frame, times every
// frame in the gallery, exhausts memory.
//
// Keep it small, but cover the states a design review cares about: a full and
// an empty meal, a recipe and a variant, OpenFoodFacts and manual foods, a
// very long name, past days for trends, a finished workout with history.

import { expoDb } from "@/src/services/db";
import { formatDateKey } from "@/src/utils/date";

type Row = Record<string, string | number | null>;

async function insert(table: string, row: Row): Promise<number> {
    const cols = Object.keys(row);
    const result = await expoDb.runAsync(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        cols.map((c) => row[c]),
    );
    return result.lastInsertRowId;
}

/** Local time `daysAgo` days back at hh:mm, as ms since epoch. */
function at(daysAgo: number, hh: number, mm = 0): number {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hh, mm, 0, 0);
    return d.getTime();
}

function dateKey(daysAgo: number): string {
    return formatDateKey(new Date(at(daysAgo, 12)));
}

/** Deterministic pseudo-random in [0, 1) so every frame shows the same data. */
function noise(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
}

// ── Foods ────────────────────────────────────────────────────────────────────

const FOODS = {
    oats: { name: "Rolled oats", kcal: 379, p: 13.2, c: 67.7, f: 6.5, serving: 40 },
    yogurt: { name: "Greek yogurt 2%", kcal: 73, p: 9.9, c: 3.9, f: 2, serving: 150 },
    banana: { name: "Banana", kcal: 89, p: 1.1, c: 22.8, f: 0.3, serving: 118 },
    chicken: { name: "Chicken breast", kcal: 165, p: 31, c: 0, f: 3.6, serving: 150 },
    rice: { name: "Basmati rice, cooked", kcal: 130, p: 2.7, c: 28, f: 0.3, serving: 200 },
    broccoli: { name: "Broccoli", kcal: 34, p: 2.8, c: 7, f: 0.4, serving: 100 },
    oliveOil: { name: "Olive oil", kcal: 884, p: 0, c: 0, f: 100, serving: 10, unit: "ml" },
    milk: { name: "Whole milk 3.5%", kcal: 64, p: 3.3, c: 4.8, f: 3.6, serving: 200, unit: "ml", off: "4014400900507" },
    peanutButter: { name: "Peanut butter, crunchy", kcal: 588, p: 25, c: 20, f: 50, serving: 32 },
    bread: { name: "Wholegrain bread", kcal: 247, p: 13, c: 41, f: 3.4, serving: 40 },
    eggs: { name: "Eggs", kcal: 143, p: 12.6, c: 0.7, f: 9.5, serving: 50 },
    chocolate: { name: "Dark chocolate 70%", kcal: 598, p: 7.8, c: 45.9, f: 42.6, serving: 20, off: "3046920022606" },
    blueberries: { name: "Blueberries", kcal: 57, p: 0.7, c: 14.5, f: 0.3, serving: 100 },
    salmon: { name: "Salmon fillet", kcal: 208, p: 20, c: 0, f: 13, serving: 140 },
    whey: { name: "Whey protein, vanilla", kcal: 380, p: 78, c: 7, f: 5, serving: 30 },
    almondDrink: {
        name: "Organic unsweetened almond & hazelnut drink with added calcium and vitamins",
        kcal: 24, p: 0.9, c: 0.3, f: 1.9, serving: 250, unit: "ml",
    },
};
type FoodKey = keyof typeof FOODS;

async function seedFoods(): Promise<Record<FoodKey, number>> {
    const ids = {} as Record<FoodKey, number>;
    for (const [key, food] of Object.entries(FOODS) as [FoodKey, (typeof FOODS)[FoodKey]][]) {
        const off = "off" in food ? food.off : null;
        ids[key] = await insert("foods", {
            name: food.name,
            calories_per_100g: food.kcal,
            protein_per_100g: food.p,
            carbs_per_100g: food.c,
            fat_per_100g: food.f,
            source: off ? "openfoodfacts" : "manual",
            barcode: off,
            openfoodfacts_id: off,
            default_unit: "unit" in food ? food.unit : "g",
            serving_size: food.serving,
        });
    }
    await insert("serving_units", { food_id: ids.banana, name: "Medium banana", grams: 118 });
    await insert("serving_units", { food_id: ids.bread, name: "Slice", grams: 40 });
    await insert("serving_units", { food_id: ids.eggs, name: "Egg (M)", grams: 50 });
    await insert("serving_units", { food_id: ids.milk, name: "Glass", grams: 200, display_unit: "ml", kind: "serving" });
    await insert("serving_units", { food_id: ids.chocolate, name: "Bar", grams: 100, kind: "package" });
    return ids;
}

// ── Recipes ──────────────────────────────────────────────────────────────────

type Recipe = { id: number; servings: number; items: [FoodKey, number][] };

async function seedRecipe(
    foods: Record<FoodKey, number>,
    name: string,
    servings: number,
    items: [FoodKey, number][],
    parentId: number | null = null,
): Promise<Recipe> {
    const id = await insert("recipes", { name, servings, parent_recipe_id: parentId });
    for (const [food, grams] of items) {
        await insert("recipe_items", { recipe_id: id, food_id: foods[food], quantity_grams: grams });
    }
    return { id, servings, items };
}

// ── Log ──────────────────────────────────────────────────────────────────────

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_TIME: Record<Meal, [number, number]> = {
    breakfast: [8, 0], lunch: [12, 30], snack: [15, 30], dinner: [19, 0],
};

async function logFood(foods: Record<FoodKey, number>, daysAgo: number, meal: Meal, food: FoodKey, grams: number) {
    await insert("entries", {
        food_id: foods[food],
        quantity_grams: Math.round(grams),
        timestamp: at(daysAgo, ...MEAL_TIME[meal]),
        date: dateKey(daysAgo),
        meal_type: meal,
    });
}

/** Mirrors logDb.logRecipe: one recipe_logs row + one entry per item, scaled. */
async function logRecipe(foods: Record<FoodKey, number>, daysAgo: number, meal: Meal, recipe: Recipe, servingsEaten = 1) {
    const portion = servingsEaten / recipe.servings;
    const timestamp = at(daysAgo, ...MEAL_TIME[meal]);
    const recipeLogId = await insert("recipe_logs", {
        recipe_id: recipe.id, date: dateKey(daysAgo), meal_type: meal, portion, timestamp,
    });
    for (const [food, grams] of recipe.items) {
        await insert("entries", {
            food_id: foods[food],
            quantity_grams: grams * portion,
            timestamp,
            date: dateKey(daysAgo),
            meal_type: meal,
            recipe_log_id: recipeLogId,
        });
    }
}

async function seedLog(foods: Record<FoodKey, number>, oats: Recipe, bowl: Recipe, salmonBowl: Recipe) {
    // Today: breakfast and lunch from recipes, a snack, dinner still empty.
    await logRecipe(foods, 0, "breakfast", oats);
    await logFood(foods, 0, "breakfast", "banana", 118);
    await logRecipe(foods, 0, "lunch", bowl);
    await logFood(foods, 0, "snack", "whey", 30);
    await logFood(foods, 0, "snack", "chocolate", 20);
    await logFood(foods, 0, "snack", "almondDrink", 250);

    // Three weeks of history for trends, varying around the goals.
    for (let d = 1; d <= 21; d++) {
        const v = 0.8 + noise(d) * 0.4;
        if (d % 3 === 0) await logRecipe(foods, d, "breakfast", oats);
        else {
            await logFood(foods, d, "breakfast", "bread", 80 * v);
            await logFood(foods, d, "breakfast", "eggs", 100);
        }
        await logRecipe(foods, d, "lunch", d % 2 ? bowl : salmonBowl, Math.round(v * 4) / 4);
        await logFood(foods, d, "dinner", "salmon", 140 * v);
        await logFood(foods, d, "dinner", "rice", 180 * v);
        await logFood(foods, d, "dinner", "broccoli", 120);
        if (noise(d + 50) > 0.4) await logFood(foods, d, "snack", "chocolate", 25 * v);
        if (noise(d + 80) > 0.5) await logFood(foods, d, "snack", "yogurt", 150);
    }

    for (let d = 0; d <= 45; d++) {
        if (d > 0 && noise(d + 120) < 0.25) continue; // the odd skipped weigh-in
        const kg = 80.1 + d * 0.05 + (noise(d + 200) - 0.5) * 0.8;
        await insert("weight_logs", { weight_kg: Math.round(kg * 10) / 10, date: dateKey(d), timestamp: at(d, 7, 15) });
    }
}

// ── Exercise ─────────────────────────────────────────────────────────────────

type SetSpec = { weight?: number; reps?: number; seconds?: number; meters?: number; type?: string; rir?: number };

async function seedExercise() {
    const ex = (name: string, type: string, muscle: string | null, equipment: string | null, extra: Row = {}) =>
        insert("exercise_templates", {
            name, type, muscle_group: muscle, equipment, created_at: at(60, 9), ...extra,
        });
    const bench = await ex("Bench press", "weight", "chest", "barbell");
    const squat = await ex("Back squat", "weight", "legs", "barbell");
    const pullUp = await ex("Pull-up", "bodyweight", "back", "bodyweight");
    const dip = await ex("Assisted dip", "bodyweight", "chest", "machine", { resistance_mode: "assistance" });
    const curl = await ex("Dumbbell curl", "weight", "arms", "dumbbell");
    const run = await ex("Running", "cardio", "full_body", null);
    const plank = await ex("Plank", "bodyweight", "core", "bodyweight");
    await ex("Grip trainer", "other", "arms", "other", {
        custom_fields: JSON.stringify([{ id: "squeezes", name: "Squeezes", unit: "reps", higherIsBetter: true }]),
    });

    const workout = async (daysAgo: number, title: string, startH: number, plan: [number, SetSpec[]][]) => {
        const start = at(daysAgo, startH);
        const workoutId = await insert("workouts", {
            date: dateKey(daysAgo), title, started_at: start, ended_at: start + 65 * 60_000,
        });
        for (const [order, [templateId, sets]] of plan.entries()) {
            const weId = await insert("workout_exercises", {
                workout_id: workoutId, exercise_template_id: templateId, sort_order: order,
                started_at: start + order * 12 * 60_000,
            });
            for (const [i, s] of sets.entries()) {
                await insert("exercise_sets", {
                    workout_exercise_id: weId, set_order: i, type: s.type ?? "working",
                    weight: s.weight ?? null, reps: s.reps ?? null, duration_seconds: s.seconds ?? null,
                    distance_meters: s.meters ?? null, rir: s.rir ?? null, rest_seconds: 120,
                    completed_at: start + (order * 12 + i * 3) * 60_000,
                });
            }
        }
    };

    const benchSets = (top: number): SetSpec[] => [
        { weight: 40, reps: 10, type: "warmup" },
        { weight: top, reps: 8, rir: 2 }, { weight: top, reps: 8, rir: 1 }, { weight: top, reps: 7, rir: 0 },
    ];
    await workout(9, "Upper body", 18, [[bench, benchSets(72.5)], [pullUp, [{ reps: 8 }, { reps: 7 }, { reps: 6 }]]]);
    await workout(7, "Legs", 18, [[squat, [{ weight: 60, reps: 8, type: "warmup" }, { weight: 95, reps: 5 }, { weight: 95, reps: 5 }]]]);
    await workout(5, "Upper body", 18, [[bench, benchSets(75)], [dip, [{ weight: 20, reps: 10 }, { weight: 20, reps: 9 }]]]);
    await workout(3, "Run", 7, [[run, [{ seconds: 1860, meters: 5200 }]]]);
    await workout(0, "Upper body", 7, [
        [bench, benchSets(77.5)],
        [pullUp, [{ reps: 9 }, { reps: 8 }, { reps: 7, type: "failure" }]],
        [curl, [{ weight: 14, reps: 12 }, { weight: 14, reps: 10 }, { weight: 10, reps: 12, type: "dropset" }]],
        [plank, [{ seconds: 60 }, { seconds: 45 }]],
    ]);
}

// ── Photos, AI ───────────────────────────────────────────────────────────────

/** Abstract placeholder "photo": a warm gradient with a soft silhouette. */
function placeholderPhoto(hue: number): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="hsl(${hue},25%,78%)"/><stop offset="1" stop-color="hsl(${hue},20%,52%)"/></linearGradient></defs>
<rect width="300" height="400" fill="url(#g)"/>
<circle cx="150" cy="120" r="42" fill="hsl(${hue},15%,35%)" opacity=".55"/>
<path d="M70 400 C80 260 110 190 150 190 C190 190 220 260 230 400Z" fill="hsl(${hue},15%,35%)" opacity=".55"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function seedPhotosAndAi() {
    for (const [daysAgo, hue] of [[0, 30], [0, 200], [14, 30]]) {
        await insert("progress_photos", {
            image_path: placeholderPhoto(hue), created_at: at(daysAgo, 7, 30), updated_at: at(daysAgo, 7, 30),
        });
    }
    for (const content of [
        "Trains upper body on Mondays and Fridays, legs on Wednesdays.",
        "Prefers savoury breakfasts on weekends.",
        "Aims to lose about 0.3 kg per week without dropping protein below 150 g.",
    ]) {
        await insert("ai_memories", { content, created_at: at(10, 20) });
    }
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function seedSampleData(): Promise<void> {
    await expoDb.withTransactionAsync(async () => {
        await expoDb.runAsync("UPDATE goals SET calories = 2300, protein = 160, carbs = 260, fat = 75 WHERE id = 1");
        await expoDb.runAsync("UPDATE goal_history SET calories = 2300, protein = 160, carbs = 260, fat = 75");

        const foods = await seedFoods();
        const oats = await seedRecipe(foods, "Overnight oats", 2, [
            ["oats", 80], ["yogurt", 300], ["blueberries", 100], ["milk", 150], ["peanutButter", 32],
        ]);
        const bowl = await seedRecipe(foods, "Chicken rice bowl", 1, [
            ["chicken", 150], ["rice", 200], ["broccoli", 120], ["oliveOil", 10],
        ]);
        const salmonBowl = await seedRecipe(foods, "Salmon rice bowl", 1, [
            ["salmon", 140], ["rice", 200], ["broccoli", 120],
        ], bowl.id);

        await seedLog(foods, oats, bowl, salmonBowl);
        await seedExercise();
        await seedPhotosAndAi();
    });
}
