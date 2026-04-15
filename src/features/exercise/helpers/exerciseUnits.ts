const LB_PER_KG = 2.20462;

export function kgToLb(kg: number): number {
    return Math.round(kg * LB_PER_KG * 10) / 10;
}

export function lbToKg(lb: number): number {
    return Math.round((lb / LB_PER_KG) * 10) / 10;
}

export function normalizeToKg(weight: number, unit: "kg" | "lb"): number {
    return unit === "lb" ? lbToKg(weight) : weight;
}

export function formatWeight(weight: number, unit: "kg" | "lb"): string {
    return `${weight} ${unit}`;
}

export function convertWeight(weight: number, fromUnit: "kg" | "lb", toUnit: "kg" | "lb"): number {
    if (fromUnit === toUnit) return weight;
    return fromUnit === "kg" ? kgToLb(weight) : lbToKg(weight);
}
