import { parseDateKey, shiftCalendarDate } from "@/src/utils/date";
import type { ThemeColors } from "@/src/utils/theme";
import type { TFunction } from "i18next";
import type { DailyTotals } from "../services/analyticsDb";
import { MACRO_KCAL, type MacroKey, type Metric } from "./analyticsHelpers";
import { amountScale, bucketUnit, levelScale, PERCENT_SCALE, timeTicks, type AxisScale, type TimeTick } from "./chartScale";
import {
    averageIntake,
    buildIntakeBuckets,
    buildWeightSeries,
    energyByMacro,
    goalOn,
    goalSteps,
    MACROS,
    macroShares,
    type GoalStep,
    type IntakeBucket,
    type WeightPoint,
} from "./chartSeries";

type NutritionKey = "calories" | MacroKey;

/** Past this many weigh-ins the single dots only blur the line. */
const MAX_WEIGHT_DOTS = 120;

/** The days on the time axis: `days` of them, starting at `startKey`. */
export interface ChartRange {
    startKey: string;
    days: number;
}

export interface PlotColumn {
    from: number;
    to: number;
    /** Stacked from the baseline up. */
    segments: { value: number; color: string }[];
}

/** What stands above the plot: the whole range at rest, one column or point while it is selected. */
export interface Headline {
    caption: string;
    value?: string;
    unit?: string;
    /** Quieter addition after the value. */
    note?: string;
    /** Right-hand side of the value row, e.g. the goal. */
    aside?: string;
    tiles?: { color: string; label: string; value: string }[];
}

export interface ChartModel {
    scale: AxisScale;
    ticks: TimeTick[];
    formatTick: (value: number) => string;
    columns?: PlotColumn[];
    points?: WeightPoint[];
    /** Whether the single weigh-ins are drawn behind the trend line. */
    showDots?: boolean;
    lineColor?: string;
    goal?: GoalStep[];
    legend?: { color: string; label: string; mark: "dot" | "line" }[];
    headline: (selected: number | null) => Headline;
}

export interface ChartInput {
    metric: Metric;
    range: ChartRange;
    data: DailyTotals[];
    /** May reach back before the range, see buildWeightSeries. */
    weightLogs: { date: string; weight_kg: number }[];
    goals: Record<NutritionKey, number> | undefined;
    goalHistory: (Record<NutritionKey, number> & { date: string })[];
    weightUnit: "kg" | "lb";
    /** Multiplier from kilograms to `weightUnit`. */
    weightFactor: number;
    plotWidth: number;
    colors: ThemeColors;
    locale: string;
    t: TFunction;
}

function formatters(locale: string, startKey: string) {
    const start = parseDateKey(startKey);
    const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    const dayMonthYear = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
    return {
        number: (value: number, decimals = 0) =>
            value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
        /** "Mon, Nov 3" for one day, "Nov 3 – Nov 9" for several. */
        span: (from: number, to: number) => {
            const first = shiftCalendarDate(start, from);
            const last = shiftCalendarDate(start, to);
            if (from === to) return weekday.format(first);
            const format = first.getFullYear() === last.getFullYear() ? dayMonth : dayMonthYear;
            return `${format.format(first)} – ${format.format(last)}`;
        },
    };
}

function intakeModel({ metric, range, data, goals, goalHistory, plotWidth, colors, locale, t }: ChartInput): ChartModel | null {
    const { startKey, days } = range;
    const overall = averageIntake(data, startKey, days);
    if (!overall) return null;
    let buckets = buildIntakeBuckets(data, startKey, days, bucketUnit(days, plotWidth));
    const { number, span } = formatters(locale, startKey);
    const ticks = timeTicks(startKey, days, plotWidth, locale);
    const whole = span(0, days - 1);
    const caption = (bucket: IntakeBucket | undefined, restKey: string) => {
        if (!bucket) return `${t(restKey)} · ${whole}`;
        const label = span(bucket.from, bucket.to);
        return bucket.from === bucket.to ? label : `${label} · ${t("analytics.dailyAverage")}`;
    };
    const tiles = (value: (macro: MacroKey) => string) =>
        MACROS.map((macro) => ({ color: colors[macro], label: t(`common.${macro}`), value: value(macro) }));

    if (metric === "macros") {
        buckets = buckets.filter((bucket) => macroShares(bucket));
        const overallShares = macroShares(overall);
        if (!overallShares || buckets.length === 0) return null;
        return {
            scale: PERCENT_SCALE,
            ticks,
            formatTick: (value) => `${value}%`,
            columns: buckets.map((bucket) => {
                const shares = macroShares(bucket)!;
                return { from: bucket.from, to: bucket.to, segments: MACROS.map((m) => ({ value: shares[m], color: colors[m] })) };
            }),
            headline: (selected) => {
                const bucket = selected == null ? undefined : buckets[selected];
                const shares = bucket ? macroShares(bucket)! : overallShares;
                return {
                    caption: caption(bucket, "analytics.averageSplit"),
                    tiles: tiles((macro) => `${Math.round(shares[macro])}%`),
                };
            },
        };
    }

    const key: NutritionKey = metric === "calories" ? "calories" : (metric as MacroKey);
    const goal = goals
        ? goalSteps(goalHistory.map((entry) => ({ date: entry.date, value: entry[key] })), goals[key], startKey, days)
        : [];
    const scale = amountScale(Math.max(...buckets.map((bucket) => bucket[key]), ...goal.map((step) => step.value)));
    const goalLabel = (bucket: IntakeBucket) => {
        const value = goalOn(goal, bucket.to);
        return value == null ? undefined : `${t("analytics.goal")} ${number(value)}`;
    };
    const shared = { scale, ticks, goal, formatTick: (value: number) => number(value, scale.decimals) };

    if (key === "calories") {
        return {
            ...shared,
            columns: buckets.map((bucket) => {
                const energy = energyByMacro(bucket);
                const segments = energy
                    ? MACROS.map((macro) => ({ value: energy[macro], color: colors[macro] }))
                    : [{ value: bucket.calories, color: colors.calories }];
                return { from: bucket.from, to: bucket.to, segments };
            }),
            headline: (selected) => {
                const bucket = selected == null ? undefined : buckets[selected];
                const shown = bucket ?? overall;
                return {
                    caption: caption(bucket, "analytics.dailyAverage"),
                    value: number(shown.calories),
                    unit: t("common.kcal"),
                    aside: goalLabel(shown),
                    tiles: tiles((macro) => `${number(shown[macro])} ${t("common.g")}`),
                };
            },
        };
    }

    return {
        ...shared,
        columns: buckets.map((bucket) => ({
            from: bucket.from,
            to: bucket.to,
            segments: [{ value: bucket[key], color: colors[key] }],
        })),
        headline: (selected) => {
            const bucket = selected == null ? undefined : buckets[selected];
            const shown = bucket ?? overall;
            return {
                caption: caption(bucket, "analytics.dailyAverage"),
                value: number(shown[key]),
                unit: t("common.g"),
                note: `${number(shown[key] * MACRO_KCAL[key])} ${t("common.kcal")}`,
                aside: goalLabel(shown),
            };
        },
    };
}

function weightModel({ range, weightLogs, weightUnit, weightFactor, plotWidth, colors, locale, t }: ChartInput): ChartModel | null {
    const { startKey, days } = range;
    const points = buildWeightSeries(weightLogs, startKey, days, weightFactor);
    if (points.length === 0) return null;
    const { number, span } = formatters(locale, startKey);
    const values = points.flatMap((point) => [point.value, point.trend]);
    const scale = levelScale(Math.min(...values), Math.max(...values), weightUnit === "lb" ? 2 : 1);
    const trend = t("analytics.trend");
    const showDots = points.length <= MAX_WEIGHT_DOTS;

    return {
        scale,
        ticks: timeTicks(startKey, days, plotWidth, locale),
        formatTick: (value) => number(value, scale.decimals),
        points,
        showDots,
        lineColor: colors.weight,
        // The line alone needs no key.
        legend: showDots
            ? [
                { color: colors.weight, label: t("analytics.weighIns"), mark: "dot" },
                { color: colors.weight, label: trend, mark: "line" },
            ]
            : undefined,
        headline: (selected) => {
            const point = selected == null ? undefined : points[selected];
            if (point) {
                return {
                    caption: span(point.day, point.day),
                    value: number(point.value, 1),
                    unit: weightUnit,
                    note: `${trend} ${number(point.trend, 1)}`,
                };
            }
            const whole = span(0, days - 1);
            if (points.length < 2) {
                return { caption: `${t("analytics.weight")} · ${whole}`, value: number(points[0].value, 1), unit: weightUnit };
            }
            const change = Math.round((points[points.length - 1].trend - points[0].trend) * 10) / 10;
            const sign = change > 0 ? "+" : change < 0 ? "−" : "";
            return {
                caption: `${t("analytics.change")} · ${whole}`,
                value: `${sign}${number(Math.abs(change), 1)}`,
                unit: weightUnit,
            };
        },
    };
}

/** Everything the chart card draws for one metric and range; null when there is nothing to draw. */
export function buildChartModel(input: ChartInput): ChartModel | null {
    return input.metric === "weight" ? weightModel(input) : intakeModel(input);
}
