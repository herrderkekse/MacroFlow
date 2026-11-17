import { describe, expect, it } from "@jest/globals";
import type { BarPathData } from "../../types";
import { analyzeReps, bridge } from "../repAnalysis";
import { squatHeight } from "./syntheticVideo";

// The plate is 90 px across, so 1 px is 0.5 cm.
const MARKER = { x: 100, y: 100, r: 45 };

function path(heightPx: (t: number) => number, durationMs: number, lost: (t: number) => boolean = () => false): BarPathData {
    const t: number[] = [], x: number[] = [], y: number[] = [], score: number[] = [];
    for (let ms = 0; ms <= durationMs; ms += 1000 / 30) {
        t.push(ms);
        x.push(MARKER.x + Math.sin(ms / 300) * 2);
        y.push(MARKER.y + heightPx(ms));
        score.push(lost(ms) ? 0 : 1);
    }
    return { version: 1, frameWidth: 320, frameHeight: 180, marker: MARKER, plateDiameterM: 0.45, t, x, y, score };
}

describe("analyzeReps", () => {
    it("counts squats and measures each from its plate", () => {
        // 3 reps of 100 px = 50 cm, each way up in 1 s.
        const result = analyzeReps(path((t) => squatHeight(t, 100), 7400));
        expect(result.reps).toHaveLength(3);
        for (const rep of result.reps) {
            expect(rep.rangeM).toBeGreaterThan(0.45);
            expect(rep.rangeM).toBeLessThan(0.52);
            // 0.5 m in about a second, measured between the frames it starts and stops moving.
            expect(rep.meanVelocity).toBeGreaterThan(0.45);
            expect(rep.meanVelocity).toBeLessThan(0.7);
            expect(rep.peakVelocity).toBeGreaterThan(rep.meanVelocity);
            expect(rep.loweringMs).toBeGreaterThan(800);
            expect(rep.loweringMs).toBeLessThan(1300);
            expect(rep.driftM).toBeLessThan(0.03);
        }
        expect(result.confidence).toBe(1);
        expect(result.velocityLoss).not.toBeNull();
        expect(result.velocityLoss!).toBeLessThan(0.1);
    });

    it("has no way down for a rep that starts from the floor", () => {
        // Deadlift: starts at the bottom, up in 1 s, held, put down.
        const deadlift = (t: number) => (t < 500 ? 100 : t < 1500 ? 100 - 100 * ((t - 500) / 1000) : t < 2500 ? 0 : 100);
        const result = analyzeReps(path(deadlift, 3000));
        expect(result.reps).toHaveLength(1);
        expect(result.reps[0].loweringMs).toBeNull();
    });

    it("ignores movements much smaller than the reps, like an unrack", () => {
        const unrackThenSquat = (t: number) => (t < 1000 ? 20 * Math.min(1, t / 500) * -1 + 20 : squatHeight(t - 1000, 100));
        const result = analyzeReps(path(unrackThenSquat, 6000));
        expect(result.reps).toHaveLength(2);
    });

    it("counts a grind through a sticking point as one rep", () => {
        // Up 50 px, stuck for 0.6 s, up the other 50 px.
        const grind = (t: number) => {
            if (t < 500) return 100;
            if (t < 1500) return 100 - 50 * ((t - 500) / 1000);
            if (t < 2100) return 50;
            if (t < 3100) return 50 - 50 * ((t - 2100) / 1000);
            return 0;
        };
        const result = analyzeReps(path(grind, 4000));
        expect(result.reps).toHaveLength(1);
        expect(result.reps[0].rangeM).toBeGreaterThan(0.45);
    });

    it("ends the way up at lockout, not after lifting the bar into the rack", () => {
        // A rep up to lockout at 2.5 s, a pause, then 8 px (4 cm) up into the hooks.
        const rerack = (t: number) => (t < 2500 ? squatHeight(t, 100) : t < 3000 ? 0 : -8 * Math.min(1, (t - 3000) / 400));
        const result = analyzeReps(path(rerack, 4000));
        expect(result.reps).toHaveLength(1);
        expect(result.reps[0].liftEndMs).toBeLessThan(2600);
    });

    it("does not count a rep across a long stretch where the plate was lost", () => {
        const result = analyzeReps(path((t) => squatHeight(t, 100), 4900, (t) => t > 1600 && t < 2300));
        expect(result.reps).toHaveLength(1);
        expect(result.confidence).toBeLessThan(1);
    });
});

describe("bridge", () => {
    it("joins short gaps and leaves long ones open", () => {
        const t = [0, 100, 200, 300, 400, 900, 1000];
        const values = [0, 0, 0, 30, 0, 0, 60];
        const found = [true, false, false, true, false, false, true];
        const out = bridge(t, values, found);
        expect(out[1]).toBeCloseTo(10);
        expect(out[2]).toBeCloseTo(20);
        expect(Number.isNaN(out[4])).toBe(true);
        expect(Number.isNaN(out[5])).toBe(true);
    });
});
