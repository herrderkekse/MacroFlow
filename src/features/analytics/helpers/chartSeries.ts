import type { BucketUnit } from "@/src/utils/chartScale";
import { diffDateKeys, parseDateKey, shiftCalendarDate } from "@/src/utils/date";
import type { DailyTotals } from "../services/analyticsDb";
import { MACRO_KCAL, type MacroKey } from "./analyticsHelpers";

export const MACROS: MacroKey[] = ["protein", "carbs", "fat"];

// ── Intake ─────────────────────────────────────────────────

/** One column: a day, or the average logged day of a week or month. */
export interface IntakeBucket {
    /** First and last day it covers, counted from the start of the axis. */
    from: number;
    to: number;
    loggedDays: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

function average(rows: DailyTotals[], from: number, to: number): IntakeBucket {
    const mean = (key: "calories" | MacroKey) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
    return {
        from,
        to,
        loggedDays: rows.length,
        calories: mean("calories"),
        protein: mean("protein"),
        carbs: mean("carbs"),
        fat: mean("fat"),
    };
}

/**
 * Groups logged days into columns. Days without entries are left out rather
 * than counted as zero, so a week's column is the average of its logged days.
 */
export function buildIntakeBuckets(data: DailyTotals[], startKey: string, days: number, unit: BucketUnit): IntakeBucket[] {
    const start = parseDateKey(startKey);
    const groups = new Map<number, { to: number; rows: DailyTotals[] }>();
    for (const row of data) {
        const day = diffDateKeys(row.date, startKey);
        if (day < 0 || day >= days) continue;
        let from = day;
        let to = day;
        if (unit !== "day") {
            const date = shiftCalendarDate(start, day);
            if (unit === "week") {
                from = day - ((date.getDay() + 6) % 7); // back to Monday
                to = from + 6;
            } else {
                from = day - (date.getDate() - 1);
                to = from + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() - 1;
            }
        }
        const group = groups.get(from) ?? { to, rows: [] };
        group.rows.push(row);
        groups.set(from, group);
    }
    return Array.from(groups.entries())
        .sort(([a], [b]) => a - b)
        .map(([from, { to, rows }]) => average(rows, Math.max(0, from), Math.min(days - 1, to)));
}

/** The average logged day of the whole axis. */
export function averageIntake(data: DailyTotals[], startKey: string, days: number): IntakeBucket | null {
    const rows = data.filter((row) => {
        const day = diffDateKeys(row.date, startKey);
        return day >= 0 && day < days;
    });
    return rows.length > 0 ? average(rows, 0, days - 1) : null;
}

/**
 * Calories split by macro. Logged calories rarely equal 4/4/9 times the
 * macros (alcohol, fibre, rounding), so the macro energies are scaled to add
 * up to the logged calories. Null when no macros are known.
 */
export function energyByMacro(bucket: IntakeBucket): Record<MacroKey, number> | null {
    const fromMacros = MACROS.reduce((sum, macro) => sum + bucket[macro] * MACRO_KCAL[macro], 0);
    if (fromMacros <= 0) return null;
    const factor = bucket.calories / fromMacros;
    return {
        protein: bucket.protein * MACRO_KCAL.protein * factor,
        carbs: bucket.carbs * MACRO_KCAL.carbs * factor,
        fat: bucket.fat * MACRO_KCAL.fat * factor,
    };
}

/** Each macro's share of the energy, in percent. Null when no macros are known. */
export function macroShares(bucket: IntakeBucket): Record<MacroKey, number> | null {
    const total = MACROS.reduce((sum, macro) => sum + bucket[macro] * MACRO_KCAL[macro], 0);
    if (total <= 0) return null;
    return {
        protein: (bucket.protein * MACRO_KCAL.protein * 100) / total,
        carbs: (bucket.carbs * MACRO_KCAL.carbs * 100) / total,
        fat: (bucket.fat * MACRO_KCAL.fat * 100) / total,
    };
}

// ── Weight ─────────────────────────────────────────────────

/** The trend looks this many days back and ahead of each weigh-in. */
export const WEIGHT_TREND_REACH = 5;

export interface WeightPoint {
    day: number;
    /** Mean of that day's weigh-ins. */
    value: number;
    /** The weigh-ins around that day, smoothed: see buildWeightSeries. */
    trend: number;
}

/**
 * One point per weigh-in day on the axis, with its trend: the mean of the
 * weigh-in days within WEIGHT_TREND_REACH days, each counting less the
 * further away it is. That is about as steady as a plain weekly average, but
 * it is centred, so the line runs through the weigh-ins instead of trailing
 * behind them, and a single odd weigh-in fades in and out instead of making
 * a step. `logs` may reach back before the axis starts, so that the first
 * points have their neighbours too.
 */
export function buildWeightSeries(
    logs: { date: string; weight_kg: number }[],
    startKey: string,
    days: number,
    factor = 1,
): WeightPoint[] {
    const byDay = new Map<number, number[]>();
    for (const log of logs) {
        const day = diffDateKeys(log.date, startKey);
        if (day >= days) continue;
        byDay.set(day, [...(byDay.get(day) ?? []), log.weight_kg * factor]);
    }
    const daily = Array.from(byDay.entries())
        .sort(([a], [b]) => a - b)
        .map(([day, values]) => ({ day, value: values.reduce((a, b) => a + b, 0) / values.length }));

    return daily
        .filter((point) => point.day >= 0)
        .map((point) => {
            let sum = 0;
            let weights = 0;
            for (const other of daily) {
                const weight = WEIGHT_TREND_REACH + 1 - Math.abs(other.day - point.day);
                if (weight <= 0) continue;
                sum += other.value * weight;
                weights += weight;
            }
            return { ...point, trend: sum / weights };
        });
}

// ── Goals ──────────────────────────────────────────────────

/** A goal that held from day `from` up to (not including) day `to`. */
export interface GoalStep {
    from: number;
    to: number;
    value: number;
}

/**
 * The goal over the axis as steps, from the recorded changes (oldest first).
 * Days before the first recorded change use the current goal, like the log
 * does. A goal of zero means "no goal" and leaves a gap.
 */
export function goalSteps(
    history: { date: string; value: number }[],
    current: number,
    startKey: string,
    days: number,
): GoalStep[] {
    const changes = new Map<number, number>([[0, current]]);
    for (const snapshot of history) {
        const day = diffDateKeys(snapshot.date, startKey);
        if (day >= days) break;
        changes.set(Math.max(0, day), snapshot.value);
    }
    const steps: GoalStep[] = [];
    for (const [from, value] of Array.from(changes.entries()).sort(([a], [b]) => a - b)) {
        const last = steps[steps.length - 1];
        if (last) last.to = from;
        if (last && last.value === value) last.to = days;
        else steps.push({ from, to: days, value });
    }
    return steps.filter((step) => step.value > 0);
}

export function goalOn(steps: GoalStep[], day: number): number | null {
    return steps.find((step) => day >= step.from && day < step.to)?.value ?? null;
}
