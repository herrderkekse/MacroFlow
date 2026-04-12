import { getServingUnits } from "@/src/features/templates/services/templateDb";
import { fromGrams, isValidUnit, toGrams } from "@/src/utils/units";

/**
 * Resolve a user-facing quantity + unit into internal grams.
 * Supports standard FoodUnits (g, ml, oz, …) and custom serving unit names.
 */
export function resolveQuantityToGrams(
    quantity: number,
    unit: string,
    foodId: number,
): { grams: number } | { error: string } {
    if (isValidUnit(unit)) {
        return { grams: toGrams(quantity, unit) };
    }

    const servingUnits = getServingUnits(foodId);
    const match = servingUnits.find((u) => u.name.toLowerCase() === unit.toLowerCase());
    if (match) {
        return { grams: quantity * match.grams };
    }

    const available = servingUnits.map((u) => `"${u.name}"`).join(", ");
    const hint = available
        ? ` Custom units for this food: ${available}.`
        : " This food has no custom serving units.";
    return {
        error: `Unknown unit "${unit}". Use a standard unit (g, ml, oz, fl_oz, cup, tbsp, tsp, lb) or a custom serving unit for this food.${hint}`,
    };
}

/**
 * Convert a stored entry (quantity_grams + quantity_unit) back to a display quantity + unit.
 */
export function displayQuantity(
    quantityGrams: number,
    quantityUnit: string,
    foodId: number | null,
): { quantity: number; unit: string } {
    if (isValidUnit(quantityUnit)) {
        return {
            quantity: Math.round(fromGrams(quantityGrams, quantityUnit) * 10) / 10,
            unit: quantityUnit,
        };
    }

    if (foodId) {
        const units = getServingUnits(foodId);
        const match = units.find((u) => u.name === quantityUnit);
        if (match && match.grams > 0) {
            return {
                quantity: Math.round((quantityGrams / match.grams) * 10) / 10,
                unit: quantityUnit,
            };
        }
    }

    return { quantity: Math.round(quantityGrams * 10) / 10, unit: "g" };
}
