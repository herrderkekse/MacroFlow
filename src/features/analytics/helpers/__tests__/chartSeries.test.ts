import { describe, expect, it } from "@jest/globals";
import {
    averageIntake,
    buildIntakeBuckets,
    buildWeightSeries,
    energyByMacro,
    goalOn,
    goalSteps,
    macroShares,
} from "../chartSeries";

const day = (date: string, calories: number, protein = 0, carbs = 0, fat = 0) => ({ date, calories, protein, carbs, fat });

describe("buildIntakeBuckets", () => {
    it("places each day by its date, leaving unlogged days out", () => {
        const buckets = buildIntakeBuckets([day("2026-11-02", 2000), day("2026-11-05", 1800)], "2026-11-01", 7, "day");
        expect(buckets.map((b) => [b.from, b.to, b.calories])).toEqual([[1, 1, 2000], [4, 4, 1800]]);
    });

    it("ignores days outside the axis", () => {
        const buckets = buildIntakeBuckets([day("2026-10-31", 1), day("2026-11-08", 1)], "2026-11-01", 7, "day");
        expect(buckets).toEqual([]);
    });

    it("averages the logged days of a Monday-to-Sunday week", () => {
        // 2026-11-02 is a Monday.
        const data = [day("2026-11-02", 2000), day("2026-11-04", 1000), day("2026-11-09", 3000)];
        const buckets = buildIntakeBuckets(data, "2026-11-02", 14, "week");
        expect(buckets.map((b) => [b.from, b.to, b.loggedDays, b.calories])).toEqual([[0, 6, 2, 1500], [7, 13, 1, 3000]]);
    });

    it("clips a week that the axis starts or ends in", () => {
        const buckets = buildIntakeBuckets([day("2026-11-05", 2000)], "2026-11-04", 3, "week");
        expect(buckets.map((b) => [b.from, b.to])).toEqual([[0, 2]]);
    });

    it("groups by calendar month", () => {
        const data = [day("2026-10-20", 1000), day("2026-11-03", 2000), day("2026-11-30", 4000)];
        const buckets = buildIntakeBuckets(data, "2026-10-15", 47, "month");
        expect(buckets.map((b) => [b.from, b.to, b.calories])).toEqual([[0, 16, 1000], [17, 46, 3000]]);
    });
});

describe("averageIntake", () => {
    it("averages over logged days only", () => {
        expect(averageIntake([day("2026-11-02", 2000), day("2026-11-05", 1000)], "2026-11-01", 7)?.calories).toBe(1500);
    });

    it("is null without data on the axis", () => {
        expect(averageIntake([day("2026-10-01", 2000)], "2026-11-01", 7)).toBeNull();
    });
});

describe("macro energy", () => {
    const bucket = { from: 0, to: 0, loggedDays: 1, ...day("2026-11-02", 2200, 100, 200, 100) };

    it("scales the macro energies to add up to the logged calories", () => {
        // 400 + 800 + 900 = 2100 kcal from macros, logged as 2200.
        const energy = energyByMacro(bucket)!;
        expect(energy.protein + energy.carbs + energy.fat).toBeCloseTo(2200);
        expect(energy.fat / energy.protein).toBeCloseTo(900 / 400);
    });

    it("gives each macro's share of the energy", () => {
        const shares = macroShares(bucket)!;
        expect(shares.protein).toBeCloseTo((400 / 2100) * 100);
        expect(shares.protein + shares.carbs + shares.fat).toBeCloseTo(100);
    });

    it("is null when only calories were logged", () => {
        const caloriesOnly = { ...bucket, protein: 0, carbs: 0, fat: 0 };
        expect(energyByMacro(caloriesOnly)).toBeNull();
        expect(macroShares(caloriesOnly)).toBeNull();
    });
});

describe("buildWeightSeries", () => {
    const log = (date: string, weight_kg: number) => ({ date, weight_kg });

    it("places weigh-ins by date and averages several on one day", () => {
        const points = buildWeightSeries([log("2026-11-01", 80), log("2026-11-01", 81), log("2026-11-10", 79)], "2026-11-01", 14);
        expect(points.map((p) => [p.day, p.value])).toEqual([[0, 80.5], [9, 79]]);
    });

    it("smooths each point with its neighbours, the nearer the heavier", () => {
        const logs = [log("2026-11-01", 80), log("2026-11-03", 83), log("2026-11-20", 70)];
        const points = buildWeightSeries(logs, "2026-11-01", 30);
        // Two days apart: own weigh-in counts 6, the other 4. Nov 20 has no neighbours within reach.
        expect(points.map((p) => p.trend)).toEqual([81.2, 81.8, 70]);
    });

    it("is flat through weigh-ins that do not change", () => {
        const logs = [log("2026-11-01", 80), log("2026-11-02", 80), log("2026-11-05", 80)];
        expect(buildWeightSeries(logs, "2026-11-01", 7).map((p) => p.trend)).toEqual([80, 80, 80]);
    });

    it("uses weigh-ins from before the axis for the first points without plotting them", () => {
        const points = buildWeightSeries([log("2026-10-30", 85), log("2026-11-01", 80)], "2026-11-01", 7);
        expect(points).toEqual([{ day: 0, value: 80, trend: 82 }]);
    });

    it("converts units", () => {
        expect(buildWeightSeries([log("2026-11-01", 80)], "2026-11-01", 7, 2)[0].value).toBe(160);
    });
});

describe("goalSteps", () => {
    it("is one step at the current goal when it never changed", () => {
        expect(goalSteps([], 2000, "2026-11-01", 30)).toEqual([{ from: 0, to: 30, value: 2000 }]);
    });

    it("uses the goal that was in force before the axis starts", () => {
        const steps = goalSteps([{ date: "2026-09-01", value: 1800 }], 2500, "2026-11-01", 30);
        expect(steps).toEqual([{ from: 0, to: 30, value: 1800 }]);
    });

    it("steps where the goal changed, with the current goal before the first record", () => {
        const history = [{ date: "2026-11-11", value: 1800 }, { date: "2026-11-21", value: 2200 }];
        const steps = goalSteps(history, 2200, "2026-11-01", 30);
        expect(steps).toEqual([
            { from: 0, to: 10, value: 2200 },
            { from: 10, to: 20, value: 1800 },
            { from: 20, to: 30, value: 2200 },
        ]);
        expect(goalOn(steps, 9)).toBe(2200);
        expect(goalOn(steps, 10)).toBe(1800);
    });

    it("merges a change that did not change the value", () => {
        expect(goalSteps([{ date: "2026-11-11", value: 2000 }], 2000, "2026-11-01", 30)).toEqual([{ from: 0, to: 30, value: 2000 }]);
    });

    it("leaves a gap where the goal was switched off", () => {
        const steps = goalSteps([{ date: "2026-11-11", value: 0 }], 0, "2026-11-01", 30);
        expect(steps).toEqual([]);
        expect(goalOn(steps, 5)).toBeNull();
    });
});
