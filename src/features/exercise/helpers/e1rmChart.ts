import type { TimeSeriesModel } from "@/src/shared/components/TimeSeriesPlot";
import { chartFormatters, levelScale, timeTicks, type ChartRange } from "@/src/utils/chartScale";
import { diffDateKeys, formatDateKey, shiftCalendarDate } from "@/src/utils/date";
import type { TFunction } from "i18next";
import type { Estimated1RMPoint } from "../services/exerciseStatsDb";
import { kgToLb } from "./exerciseUnits";

/** How far back the chart looks, in days. */
export type HistorySpan = 30 | 90 | 180 | 365 | "all";

export const HISTORY_SPANS: { key: HistorySpan; labelKey: string }[] = [
    { key: 30, labelKey: "exercise.history.spanMonth" },
    { key: 90, labelKey: "exercise.history.spanThreeMonths" },
    { key: 180, labelKey: "exercise.history.spanSixMonths" },
    { key: 365, labelKey: "exercise.history.spanYear" },
    { key: "all", labelKey: "exercise.history.spanAll" },
];

/** "All" never shows less than this, so that the first sessions are not stretched across the card. */
const MIN_DAYS = 30;
/** Past this many sessions the single marks only crowd the line. */
const MAX_MARKS = 80;

/**
 * The days the chart shows: the last `span` days up to `today`, or for "all"
 * everything since the first session. Null when there is no session at all.
 */
export function historyRange(span: HistorySpan, series: { date: string }[], today = new Date()): ChartRange | null {
    if (series.length === 0) return null;
    const endKey = formatDateKey(today);
    const first = series.reduce((min, point) => (point.date < min ? point.date : min), series[0].date);
    const wanted = span === "all" ? Math.max(MIN_DAYS, diffDateKeys(endKey, first) + 1) : span;
    return { startKey: formatDateKey(shiftCalendarDate(today, -(wanted - 1))), days: wanted };
}

export interface E1rmChartInput {
    /** One point per training day, in any order. */
    series: Estimated1RMPoint[];
    /** The best estimate ever, in kilograms, drawn as the line to beat. */
    personalBestKg: number | null;
    range: ChartRange;
    unit: "kg" | "lb";
    /** Assisted exercises: less assistance is better, so the line should fall. */
    isLowerBetter: boolean;
    plotWidth: number;
    color: string;
    locale: string;
    t: TFunction;
}

/**
 * The estimated one-rep maximum over time: each training day's best set as
 * a point, the latest one as the headline, the personal best as the dashed
 * line. Null when no session falls into the range.
 */
export function buildE1rmModel(input: E1rmChartInput): TimeSeriesModel | null {
    const { series, personalBestKg, range, unit, isLowerBetter, plotWidth, color, locale, t } = input;
    const { startKey, days } = range;
    const inUnit = (kg: number) => (unit === "lb" ? kgToLb(kg) : Math.round(kg * 10) / 10);

    const sessions = series
        .map((point) => ({ ...point, day: diffDateKeys(point.date, startKey) }))
        .filter((point) => point.day >= 0 && point.day < days)
        .sort((a, b) => a.day - b.day);
    if (sessions.length === 0) return null;

    const points = sessions.map((session) => ({ day: session.day, value: inUnit(session.e1rm) }));
    const best = personalBestKg == null ? null : inUnit(personalBestKg);
    const values = points.map((point) => point.value).concat(best ?? []);
    // A few percent are within the noise of an estimate; do not zoom in on them.
    const scale = levelScale(Math.min(...values), Math.max(...values), Math.max(...values) * 0.1);

    const { number, span } = chartFormatters(locale, startKey);
    const figure = (value: number) => number(value, Number.isInteger(value) ? 0 : 1);
    const title = `${t("exercise.history.estimated1RM")}${isLowerBetter ? " ↓" : ""}`;
    const aside = best == null ? undefined : `${t("exercise.history.best")} ${figure(best)}`;

    return {
        days,
        scale,
        ticks: timeTicks(startKey, days, plotWidth, locale),
        formatTick: (value) => number(value, scale.decimals),
        points,
        showDots: points.length <= MAX_MARKS,
        lineColor: color,
        reference: best == null ? undefined : [{ from: 0, to: days, value: best }],
        headline: (selected) => {
            const session = selected == null ? undefined : sessions[selected];
            if (!session) {
                const latest = points[points.length - 1];
                return { caption: `${title} · ${span(0, days - 1)}`, value: figure(latest.value), unit, aside };
            }
            return {
                caption: span(session.day, session.day),
                value: figure(inUnit(session.e1rm)),
                unit,
                note: `${figure(inUnit(session.weightKg))} ${unit} × ${session.reps}`,
                aside,
            };
        },
    };
}
