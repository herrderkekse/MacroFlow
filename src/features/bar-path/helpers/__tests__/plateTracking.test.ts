import { describe, expect, it } from "@jest/globals";
import { snapPlate } from "../plateDetector";
import { PlateTracker } from "../plateTracker";
import { drawFrame, squatHeight } from "./syntheticVideo";

const W = 320;
const H = 180;
const PLATE = { x: 120, y: 50, r: 24, shade: 60 };
const DECOY = { x: 260, y: 120, r: 24, shade: 60 };

describe("snapPlate", () => {
    it("finds the plate's rim from a tap near its centre", () => {
        const frame = drawFrame(W, H, PLATE, DECOY);
        const marker = snapPlate(frame, PLATE.x + 5, PLATE.y - 4);
        expect(Math.abs(marker.x - PLATE.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(marker.y - PLATE.y)).toBeLessThanOrEqual(2);
        // The rim, not the hub.
        expect(Math.abs(marker.r - PLATE.r)).toBeLessThanOrEqual(3);
    });

    it("keeps the tap when no outline stands out there", () => {
        const frame = drawFrame(W, H, PLATE);
        const marker = snapPlate(frame, 280, 30);
        expect(marker.x).toBe(280);
        expect(marker.y).toBe(30);
        expect(marker.r).toBeGreaterThan(0);
    });
});

describe("PlateTracker", () => {
    it("follows a plate through squats, past a look-alike plate standing still", () => {
        const depth = 80;
        const first = drawFrame(W, H, PLATE, DECOY);
        const tracker = new PlateTracker(first, { x: PLATE.x, y: PLATE.y, r: PLATE.r });
        let worst = 0;
        let total = 0;
        for (let i = 0; i < 150; i++) {
            const t = (i * 1000) / 30;
            const truth = { ...PLATE, y: PLATE.y + squatHeight(t, depth), x: PLATE.x + 3 * Math.sin(t / 700) };
            const point = tracker.track(drawFrame(W, H, truth, DECOY), t);
            expect(point.score).toBeGreaterThan(0);
            const error = Math.hypot(point.x - truth.x, point.y - truth.y);
            worst = Math.max(worst, error);
            total += error;
        }
        // The plate is 48 px across: about a centimetre on average, never more than a few.
        expect(total / 150).toBeLessThan(1);
        expect(worst).toBeLessThan(3);
    });

    it("reports the plate as lost while it is out of view, and picks it up again", () => {
        const tracker = new PlateTracker(drawFrame(W, H, PLATE), { x: PLATE.x, y: PLATE.y, r: PLATE.r });
        const hidden = { ...PLATE, x: -100 };
        expect(tracker.track(drawFrame(W, H, PLATE), 0).score).toBeGreaterThan(0.5);
        expect(tracker.track(drawFrame(W, H, hidden), 33).score).toBe(0);
        expect(tracker.track(drawFrame(W, H, hidden), 67).score).toBe(0);
        const back = tracker.track(drawFrame(W, H, { ...PLATE, x: PLATE.x + 10 }), 100);
        expect(back.score).toBeGreaterThan(0.5);
        expect(Math.abs(back.x - (PLATE.x + 10))).toBeLessThan(2);
    });
});
