import { describe, expect, it } from "@jest/globals";
import { amountScale, bucketUnit, levelScale, timeTicks } from "../chartScale";

describe("amountScale", () => {
    it("starts at zero and ends on a round number above the data", () => {
        expect(amountScale(1943).ticks).toEqual([0, 500, 1000, 1500, 2000]);
        expect(amountScale(2300).ticks).toEqual([0, 500, 1000, 1500, 2000, 2500]);
        expect(amountScale(138).ticks).toEqual([0, 50, 100, 150]);
    });

    it("keeps the top tick when the data lands exactly on it", () => {
        expect(amountScale(2000).max).toBe(2000);
    });

    it("still gives an axis when there is nothing to show", () => {
        expect(amountScale(0).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    });
});

describe("levelScale", () => {
    it("hugs the data instead of starting at zero", () => {
        // The case that prompted this: 79.9–82.0 kg used to be drawn on a 79–89 axis.
        const scale = levelScale(79.9, 82.0);
        expect(scale.ticks).toEqual([79.5, 80, 80.5, 81, 81.5, 82]);
        expect(scale.decimals).toBe(1);
    });

    it("uses whole steps over a wider range", () => {
        expect(levelScale(79.9, 82.6).ticks).toEqual([79, 80, 81, 82, 83]);
    });

    it("does not zoom in further than the minimum span", () => {
        const scale = levelScale(80.2, 80.3);
        expect(scale.max - scale.min).toBeGreaterThanOrEqual(1);
        expect(scale.min).toBeLessThanOrEqual(80.2);
        expect(scale.max).toBeGreaterThanOrEqual(80.3);
    });

    it("handles a single value", () => {
        const scale = levelScale(80, 80);
        expect(scale.min).toBeLessThan(80);
        expect(scale.max).toBeGreaterThan(80);
    });
});

describe("bucketUnit", () => {
    it("widens the columns as the span grows", () => {
        expect(bucketUnit(30, 280)).toBe("day");
        expect(bucketUnit(90, 280)).toBe("week");
        expect(bucketUnit(365, 280)).toBe("week");
        expect(bucketUnit(1500, 280)).toBe("month");
    });
});

describe("timeTicks", () => {
    const labels = (startKey: string, days: number, width = 280) =>
        timeTicks(startKey, days, width, "en-US").map((tick) => tick.label);

    it("names every weekday of a week", () => {
        expect(labels("2026-11-07", 7)).toEqual(["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
    });

    it("labels every other day of two weeks, ending on the last one", () => {
        expect(labels("2026-10-31", 14)).toEqual(["Nov 1", "3", "5", "7", "9", "11", "13"]);
    });

    it("labels the Mondays of a month and names the month where it changes", () => {
        expect(labels("2026-10-15", 30)).toEqual(["Oct 19", "26", "Nov 2", "9"]);
    });

    it("labels the months of a quarter", () => {
        expect(labels("2026-08-16", 90)).toEqual(["Sep", "Oct", "Nov"]);
    });

    it("labels every other month of a year, with the year in place of January", () => {
        expect(labels("2025-11-14", 365)).toEqual(["2026", "Mar", "May", "Jul", "Sep", "Nov"]);
    });

    it("labels years over a long history", () => {
        expect(labels("2019-06-01", 2700)).toEqual(["2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
    });

    it("places a day's label in the middle of its day and a month's at its start", () => {
        expect(timeTicks("2026-11-07", 7, 280, "en-US")[0].pos).toBe(0.5);
        expect(timeTicks("2026-08-16", 90, 280, "en-US")[0].pos).toBe(16);
    });

    it("thins the labels out on a narrow plot rather than letting them touch", () => {
        expect(labels("2026-10-31", 14, 200)).toEqual(["Nov 1", "4", "7", "10", "13"]);
    });
});
