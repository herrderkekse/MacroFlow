import { describe, expect, it } from "@jest/globals";
import type { TFunction } from "i18next";
import { buildE1rmModel, historyRange, type E1rmChartInput } from "../e1rmChart";

const today = new Date(2026, 10, 13, 12);
const point = (date: string, e1rm: number, weightKg = e1rm, reps = 1) => ({ date, e1rm, weightKg, reps });

describe("historyRange", () => {
    it("is null without sessions", () => {
        expect(historyRange(90, [], today)).toBeNull();
    });

    it("covers the last days of the span, today included", () => {
        expect(historyRange(30, [point("2026-01-01", 80)], today)).toEqual({ startKey: "2026-10-15", days: 30 });
    });

    it("starts at the first session for all, whatever the order", () => {
        const series = [point("2026-09-01", 82), point("2026-05-18", 80)];
        expect(historyRange("all", series, today)).toEqual({ startKey: "2026-05-18", days: 180 });
    });

    it("does not stretch a short history across the card", () => {
        expect(historyRange("all", [point("2026-11-10", 80)], today)).toEqual({ startKey: "2026-10-15", days: 30 });
    });
});

describe("buildE1rmModel", () => {
    const t = ((key: string) => key) as unknown as TFunction;
    const input = (overrides: Partial<E1rmChartInput>): E1rmChartInput => ({
        series: [point("2026-11-04", 91.8, 72.5, 8), point("2026-11-13", 98.2, 77.5, 8), point("2026-11-08", 95, 75, 8)],
        personalBestKg: 98.2,
        range: { startKey: "2026-10-15", days: 30 },
        unit: "kg",
        isLowerBetter: false,
        plotWidth: 280,
        color: "#000000",
        locale: "en-US",
        t,
        ...overrides,
    });

    it("places each session on its day, oldest first", () => {
        expect(buildE1rmModel(input({}))!.points).toEqual([
            { day: 20, value: 91.8 },
            { day: 24, value: 95 },
            { day: 29, value: 98.2 },
        ]);
    });

    it("is null when no session falls into the range", () => {
        expect(buildE1rmModel(input({ range: { startKey: "2026-01-01", days: 30 } }))).toBeNull();
    });

    it("fits the axis to the sessions and the personal best", () => {
        expect(buildE1rmModel(input({}))!.scale.ticks).toEqual([90, 92, 94, 96, 98, 100]);
        // A best from before the range still has to be on the axis.
        expect(buildE1rmModel(input({ personalBestKg: 110 }))!.scale.max).toBe(110);
    });

    it("draws the personal best across the whole range", () => {
        expect(buildE1rmModel(input({}))!.reference).toEqual([{ from: 0, to: 30, value: 98.2 }]);
        expect(buildE1rmModel(input({ personalBestKg: null }))!.reference).toBeUndefined();
    });

    it("leads with the latest session and names the best", () => {
        const headline = buildE1rmModel(input({}))!.headline(null);
        expect(headline).toMatchObject({ value: "98.2", unit: "kg", aside: "exercise.history.best 98.2" });
        expect(headline.caption).toBe("exercise.history.estimated1RM · Oct 15 – Nov 13");
    });

    it("shows the set behind a selected session", () => {
        const headline = buildE1rmModel(input({}))!.headline(0);
        expect(headline).toMatchObject({ caption: "Wed, Nov 4", value: "91.8", note: "72.5 kg × 8" });
    });

    it("converts to pounds and drops a trailing zero", () => {
        const model = buildE1rmModel(input({ unit: "lb", series: [point("2026-11-13", 100, 80, 5)], personalBestKg: null }))!;
        expect(model.points).toEqual([{ day: 29, value: 220.5 }]);
        expect(model.headline(0)).toMatchObject({ value: "220.5", unit: "lb", note: "176.4 lb × 5" });
        expect(buildE1rmModel(input({ series: [point("2026-11-13", 95)], personalBestKg: null }))!.headline(null).value).toBe("95");
    });

    it("marks an assisted exercise as lower-is-better", () => {
        expect(buildE1rmModel(input({ isLowerBetter: true }))!.headline(null).caption).toContain("↓");
    });
});
