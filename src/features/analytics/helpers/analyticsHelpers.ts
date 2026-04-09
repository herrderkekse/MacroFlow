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

export const ANIMATION_DURATION = 0;
export const CURVATURE = 0.1;
export const START_OPACITY = 1;
export const END_OPACITY = 1;
export const START_SHADE = -20;
export const END_SHADE = -20;
export const GRAPH_HEIGHT = 220;

// ── Helpers ────────────────────────────────────────────────

export function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDateKey(d);
}

export function formatLabel(date: string) {
    const parts = date.split("-");
    return `${parts[2]}/${parts[1]}`;
}

export function shadeColor(color: string, percent: number): string {
    const f = parseInt(color.slice(1), 16);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    const R = f >> 16;
    const G = (f >> 8) & 0x00ff;
    const B = f & 0x0000ff;
    const newR = Math.round((t - R) * p + R);
    const newG = Math.round((t - G) * p + G);
    const newB = Math.round((t - B) * p + B);
    return `#${(0x1000000 + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

export function computeStats(values: number[]) {
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const first = values[0];
    const last = values[values.length - 1];
    const trend = last > first ? "up" : last < first ? "down" : "flat";
    return { min, max, avg, stdDev, variance, trend };
}

export function formatNum(v: number, decimals = 1): string {
    return v.toFixed(decimals);
}
