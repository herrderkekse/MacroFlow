export type FoodUnit = "g" | "ml" | "oz" | "fl_oz" | "cup" | "tbsp" | "tsp" | "lb";

export type UnitSystem = "metric" | "imperial";

/** Conversion factor to grams (weight) or ml≈g (volume, assuming density ≈ 1). */
const TO_GRAMS: Record<FoodUnit, number> = {
    g: 1,
    ml: 1,          // 1 ml ≈ 1 g for most food liquids
    oz: 28.3495,
    fl_oz: 29.5735,
    cup: 236.588,
    tbsp: 14.787,
    tsp: 4.929,
    lb: 453.592,
};

const UNIT_LABELS: Record<FoodUnit, string> = {
    g: "g",
    ml: "ml",
    oz: "oz",
    fl_oz: "fl oz",
    cup: "cup",
    tbsp: "tbsp",
    tsp: "tsp",
    lb: "lb",
};

export const ALL_UNITS: FoodUnit[] = ["g", "ml", "oz", "fl_oz", "cup", "tbsp", "tsp", "lb"];

/** Weight units. */
export const WEIGHT_UNITS: FoodUnit[] = ["g", "oz", "lb"];

/** Volume units. */
export const VOLUME_UNITS: FoodUnit[] = ["ml", "fl_oz", "cup", "tbsp", "tsp"];

/** Units shown first depending on system preference. */
export function unitsForSystem(system: UnitSystem): FoodUnit[] {
    if (system === "imperial") return ["oz", "lb", "cup", "tbsp", "tsp", "fl_oz", "g", "ml"];
    return ["g", "ml", "oz", "lb", "cup", "tbsp", "tsp", "fl_oz"];
}

/** Convert a quantity in the given unit to grams. */
export function toGrams(quantity: number, unit: FoodUnit): number {
    return quantity * TO_GRAMS[unit];
}

/** Convert a gram value to the given unit. */
export function fromGrams(grams: number, unit: FoodUnit): number {
    return grams / TO_GRAMS[unit];
}

/** Human-readable label for a unit. */
export function unitLabel(unit: FoodUnit): string {
    return UNIT_LABELS[unit] ?? unit;
}

/** Format a quantity + unit for display, e.g. "250 ml" or "1.5 cup". */
export function formatQuantity(quantity: number, unit: FoodUnit): string {
    const val = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
    return `${val} ${unitLabel(unit)}`;
}

/** Sensible default amount when switching to a unit without prior context. */
const DEFAULT_AMOUNTS: Record<FoodUnit, number> = {
    g: 100,
    ml: 100,
    oz: 1,
    fl_oz: 1,
    cup: 1,
    tbsp: 1,
    tsp: 1,
    lb: 1,
};

export function defaultAmountForUnit(unit: FoodUnit): number {
    return DEFAULT_AMOUNTS[unit];
}

/** Check if a unit is a string we recognise. */
export function isValidUnit(s: string): s is FoodUnit {
    return ALL_UNITS.includes(s as FoodUnit);
}

/**
 * Format an entry's stored quantity_grams + quantity_unit for display.
 * Handles both standard units and custom serving unit names.
 */
export function formatEntryQuantity(quantityGrams: number, quantityUnit: string, servingGrams?: number): string {
    if (isValidUnit(quantityUnit)) {
        const displayQty = fromGrams(quantityGrams, quantityUnit);
        return formatQuantity(Math.round(displayQty * 10) / 10, quantityUnit);
    }
    // Custom serving unit: reverse the stored grams → count
    const count = servingGrams && servingGrams > 0
        ? Math.round((quantityGrams / servingGrams) * 10) / 10
        : Math.round(quantityGrams * 10) / 10;
    const val = Number.isInteger(count) ? String(count) : count.toFixed(1);
    return `${val} ${quantityUnit}`;
}
