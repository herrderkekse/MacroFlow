export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type FoodSource = "manual" | "openfoodfacts";

export const MEAL_TYPES: { key: MealType; label: string; icon: string }[] = [
    { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
    { key: "lunch", label: "Lunch", icon: "partly-sunny-outline" },
    { key: "dinner", label: "Dinner", icon: "moon-outline" },
    { key: "snack", label: "Snack", icon: "nutrition-outline" },
];
