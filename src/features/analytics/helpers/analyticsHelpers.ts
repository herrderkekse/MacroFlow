import { formatDateKey } from "@/src/utils/date";

// ── Types ──────────────────────────────────────────────────

export type TimeSpan = 7 | 14 | 30 | 90 | 365 | "all";
export type Metric = "calories" | "macros" | "carbs" | "protein" | "fat" | "weight";
export type MacroKey = "protein" | "carbs" | "fat";

// ── Constants ──────────────────────────────────────────────

export const TIME_SPANS: { key: TimeSpan; labelKey: string }[] = [
    { key: 7, labelKey: "analytics.week" },
    { key: 14, labelKey: "analytics.twoWeeks" },
    { key: 30, labelKey: "analytics.month" },
    { key: 90, labelKey: "analytics.threeMonths" },
    { key: 365, labelKey: "analytics.year" },
    { key: "all", labelKey: "analytics.all" },
];

export const METRICS: { key: Metric; labelKey: string }[] = [
    { key: "calories", labelKey: "analytics.calories" },
    { key: "macros", labelKey: "analytics.macros" },
    { key: "carbs", labelKey: "analytics.carbs" },
    { key: "protein", labelKey: "analytics.protein" },
    { key: "fat", labelKey: "analytics.fat" },
    { key: "weight", labelKey: "analytics.weight" },
];

export const MACRO_KCAL: Record<MacroKey, number> = { protein: 4, carbs: 4, fat: 9 };

export const KG_TO_LB = 2.20462;

// ── Helpers ────────────────────────────────────────────────

export function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDateKey(d);
}

export function computeStats(values: number[]) {
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const first = values[0];
    const last = values[values.length - 1];
    const trend = last > first ? "up" : last < first ? "down" : "flat";
    return { min, max, avg, median, stdDev, variance, trend };
}

export function formatNum(v: number, decimals = 1, locale?: string): string {
    return v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
