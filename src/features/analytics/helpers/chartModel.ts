import type { TimeSeriesModel } from "@/src/shared/components/TimeSeriesPlot";
import {
    amountScale,
    bucketUnit,
    chartFormatters,
    levelScale,
    PERCENT_SCALE,
    timeTicks,
    type ChartRange,
} from "@/src/utils/chartScale";
import type { ThemeColors } from "@/src/utils/theme";
import type { TFunction } from "i18next";
import type { DailyTotals } from "../services/analyticsDb";
import { MACRO_KCAL, type MacroKey, type Metric } from "./analyticsHelpers";
import {
    averageIntake,
    buildIntakeBuckets,
    buildWeightSeries,
    energyByMacro,
    goalOn,
    goalSteps,
    MACROS,
    macroShares,
    type IntakeBucket,
} from "./chartSeries";

type NutritionKey = "calories" | MacroKey;

/** Past this many weigh-ins the single dots only blur the line. */
const MAX_WEIGHT_DOTS = 120;

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

function intakeModel({ metric, range, data, goals, goalHistory, plotWidth, colors, locale, t }: ChartInput): TimeSeriesModel | null {
    const { startKey, days } = range;
    const overall = averageIntake(data, startKey, days);
    if (!overall) return null;
    let buckets = buildIntakeBuckets(data, startKey, days, bucketUnit(days, plotWidth));
    const { number, span } = chartFormatters(locale, startKey);
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
            days,
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
    const shared = { days, scale, ticks, reference: goal, formatTick: (value: number) => number(value, scale.decimals) };

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

function weightModel({ range, weightLogs, weightUnit, weightFactor, plotWidth, colors, locale, t }: ChartInput): TimeSeriesModel | null {
    const { startKey, days } = range;
    const points = buildWeightSeries(weightLogs, startKey, days, weightFactor);
    if (points.length === 0) return null;
    const { number, span } = chartFormatters(locale, startKey);
    const values = points.flatMap((point) => [point.value, point.trend]);
    const scale = levelScale(Math.min(...values), Math.max(...values), weightUnit === "lb" ? 2 : 1);
    const trend = t("analytics.trend");
    const showDots = points.length <= MAX_WEIGHT_DOTS;

    return {
        days,
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
export function buildChartModel(input: ChartInput): TimeSeriesModel | null {
    return input.metric === "weight" ? weightModel(input) : intakeModel(input);
}
