import { parseDateKey, shiftCalendarDate } from "@/src/utils/date";

// ── Value axis ─────────────────────────────────────────────

export interface AxisScale {
    min: number;
    max: number;
    /** Round values from `min` to `max`, one per gridline. */
    ticks: number[];
    /** Decimals needed to print a tick. */
    decimals: number;
}

const MAX_INTERVALS = 5;

function decimalsOf(step: number): number {
    for (let d = 0; d < 4; d++) {
        const scaled = step * 10 ** d;
        if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return d;
    }
    return 4;
}

/**
 * The smallest round step (a multiple from `multiples` times a power of ten)
 * that covers `low`…`high` in at most MAX_INTERVALS intervals.
 */
function fitScale(low: number, high: number, multiples: number[]): AxisScale {
    const span = Math.max(high - low, 1e-9);
    for (let exp = Math.floor(Math.log10(span)) - 1; ; exp++) {
        for (const multiple of multiples) {
            const step = multiple * 10 ** exp;
            const first = Math.floor(low / step + 1e-9);
            const last = Math.ceil(high / step - 1e-9);
            if (last - first > MAX_INTERVALS || last === first) continue;
            const decimals = decimalsOf(step);
            const ticks: number[] = [];
            for (let i = first; i <= last; i++) ticks.push(Number((i * step).toFixed(decimals)));
            return { min: ticks[0], max: ticks[ticks.length - 1], ticks, decimals };
        }
    }
}

/** Axis for amounts (kcal, grams): starts at zero and ends on a round number. */
export function amountScale(max: number): AxisScale {
    return fitScale(0, max > 0 ? max : 1, [1, 2, 2.5, 5]);
}

/**
 * Axis for a level (body weight): hugs the data instead of starting at zero,
 * but never zooms in further than `minSpan`, so that day-to-day noise does
 * not look like a swing.
 */
export function levelScale(min: number, max: number, minSpan = 1): AxisScale {
    let low = min;
    let high = max;
    if (high - low < minSpan) {
        const mid = (low + high) / 2;
        low = mid - minSpan / 2;
        high = mid + minSpan / 2;
    }
    return fitScale(low, high, [1, 2, 5]);
}

export const PERCENT_SCALE: AxisScale = { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], decimals: 0 };

// ── Time axis ──────────────────────────────────────────────

/** The days on a time axis: `days` of them, starting at `startKey`. */
export interface ChartRange {
    startKey: string;
    days: number;
}

export type BucketUnit = "day" | "week" | "month";

/** How many days one column stands for, so that columns stay wide enough to read and to touch. */
export function bucketUnit(days: number, plotWidth: number): BucketUnit {
    const minSlot = 5;
    if (plotWidth / days >= minSlot) return "day";
    if (plotWidth / (days / 7) >= minSlot) return "week";
    return "month";
}

export interface TimeTick {
    /** Position in days from the start of the axis; a day spans [n, n + 1). */
    pos: number;
    label: string;
}

/**
 * Labels for a time axis of `days` days starting at `startKey`, at calendar
 * positions (every day, Mondays, the first of a month, the first of a year)
 * that are as dense as `plotWidth` allows without the labels touching.
 */
export function timeTicks(startKey: string, days: number, plotWidth: number, locale: string): TimeTick[] {
    const start = parseDateKey(startKey);
    const dates = Array.from({ length: days }, (_, i) => shiftCalendarDate(start, i));
    const fits = (count: number, labelWidth: number) => count * labelWidth <= plotWidth;
    const format = (options: Intl.DateTimeFormatOptions) => {
        const formatter = new Intl.DateTimeFormat(locale, options);
        return (date: Date) => formatter.format(date);
    };
    const weekday = format({ weekday: "short" });
    const dayOnly = format({ day: "numeric" });
    const dayMonth = format({ day: "numeric", month: "short" });
    const month = format({ month: "short" });
    const year = format({ year: "numeric" });

    // Days of the month; the month is named on the first label and wherever it changes.
    const dayTicks = (indices: number[]): TimeTick[] =>
        indices.map((i, n) => {
            const isNewMonth = n === 0 || dates[i].getMonth() !== dates[indices[n - 1]].getMonth();
            return { pos: i + 0.5, label: isNewMonth ? dayMonth(dates[i]) : dayOnly(dates[i]) };
        });

    if (fits(days, 32)) return dates.map((date, i) => ({ pos: i + 0.5, label: weekday(date) }));

    // Every second or third day, counted back from the last one so that it is always named.
    const all = dates.map((_, i) => i);
    for (const step of [2, 3]) {
        const picked = all.filter((i) => (days - 1 - i) % step === 0);
        if (fits(picked.length, 40)) return dayTicks(picked);
    }

    // Mondays, then every other Monday.
    const mondays = all.filter((i) => dates[i].getDay() === 1);
    for (const step of [1, 2]) {
        const picked = mondays.filter((_, n) => (mondays.length - 1 - n) % step === 0);
        if (picked.length >= 2 && fits(picked.length, 48)) return dayTicks(picked);
    }

    const monthStarts = all.filter((i) => dates[i].getDate() === 1);
    for (const step of [1, 2, 3, 6]) {
        const picked = monthStarts.filter((i) => dates[i].getMonth() % step === 0);
        if (picked.length >= 2 && fits(picked.length, 40)) {
            return picked.map((i) => ({
                pos: i,
                label: dates[i].getMonth() === 0 ? year(dates[i]) : month(dates[i]),
            }));
        }
    }

    const yearStarts = monthStarts.filter((i) => dates[i].getMonth() === 0);
    for (const step of [1, 2, 5, 10]) {
        const picked = yearStarts.filter((i) => dates[i].getFullYear() % step === 0);
        if (picked.length >= 1 && fits(picked.length, 40)) return picked.map((i) => ({ pos: i, label: year(dates[i]) }));
    }

    // Too short for a calendar rhythm at this width: name the two ends.
    return dayTicks(days > 1 ? [0, days - 1] : [0]);
}

// ── Labels ─────────────────────────────────────────────────

/** Number and date labels for a chart whose time axis starts at `startKey`. */
export function chartFormatters(locale: string, startKey: string) {
    const start = parseDateKey(startKey);
    const thisYear = new Date().getFullYear();
    const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    const dayMonthYear = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
    return {
        number: (value: number, decimals = 0) =>
            value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
        /** "Mon, Nov 3" for one day, "Nov 3 – Nov 9" for several; with the year where it is not this one. */
        span: (from: number, to: number) => {
            const first = shiftCalendarDate(start, from);
            const last = shiftCalendarDate(start, to);
            if (from === to) return (first.getFullYear() === thisYear ? weekday : dayMonthYear).format(first);
            const format = first.getFullYear() === last.getFullYear() ? dayMonth : dayMonthYear;
            return `${format.format(first)} – ${format.format(last)}`;
        },
    };
}
