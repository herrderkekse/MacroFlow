export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type FoodSource = "manual" | "openfoodfacts";

export type AppearanceMode = "light" | "dark" | "system";

export type Language = "en" | "de";

export type { FoodUnit, UnitSystem } from "@/src/utils/units";

export const MEAL_TYPES: { key: MealType; icon: string }[] = [
    { key: "breakfast", icon: "sunny-outline" },
    { key: "lunch", icon: "partly-sunny-outline" },
    { key: "dinner", icon: "moon-outline" },
    { key: "snack", icon: "nutrition-outline" },
];
