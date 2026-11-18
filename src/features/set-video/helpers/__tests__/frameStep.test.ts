import { describe, expect, it } from "@jest/globals";
import { frameIndexAt, frameSeekMs, stepFrameMs } from "../frameStep";

const FRAME = 1000 / 30;

describe("frameIndexAt", () => {
    it("reads the frame from a time near its start, early or late", () => {
        expect(frameIndexAt(10 * FRAME, FRAME)).toBe(10);
        expect(frameIndexAt(10 * FRAME - 5, FRAME)).toBe(10);
        expect(frameIndexAt(10 * FRAME + 5, FRAME)).toBe(10);
    });

    it("reads back the frame it was sent to, on either platform", () => {
        for (const rule of ["atOrAfter", "atOrBefore"] as const) {
            expect(frameIndexAt(frameSeekMs(10, FRAME, rule), FRAME)).toBe(10);
        }
    });
});

describe("frameSeekMs", () => {
    it("aims before the frame where the player shows the next one at or after", () => {
        const ms = frameSeekMs(10, FRAME, "atOrAfter");
        expect(ms).toBeGreaterThan(9 * FRAME);
        expect(ms).toBeLessThan(10 * FRAME);
    });

    it("aims after the frame where the player shows the one at or before", () => {
        const ms = frameSeekMs(10, FRAME, "atOrBefore");
        expect(ms).toBeGreaterThan(10 * FRAME);
        expect(ms).toBeLessThan(11 * FRAME);
    });

    it("never goes before the start", () => {
        expect(frameSeekMs(0, FRAME, "atOrAfter")).toBe(0);
    });
});

describe("stepFrameMs", () => {
    const base = { fps: 30, durationMs: 2000, rule: "atOrAfter" as const };

    it("moves one frame either way", () => {
        const next = stepFrameMs({ ...base, currentMs: 10 * FRAME, direction: 1 });
        const previous = stepFrameMs({ ...base, currentMs: 10 * FRAME, direction: -1 });
        expect(frameIndexAt(next, FRAME)).toBe(11);
        expect(frameIndexAt(previous, FRAME)).toBe(9);
    });

    it("keeps moving when stepped again from where it landed", () => {
        let ms = 0;
        for (let i = 0; i < 5; i++) ms = stepFrameMs({ ...base, currentMs: ms, direction: 1 });
        expect(frameIndexAt(ms, FRAME)).toBe(5);
    });

    it("stops at the first and the last frame", () => {
        expect(stepFrameMs({ ...base, currentMs: 0, direction: -1 })).toBe(0);
        const last = stepFrameMs({ ...base, currentMs: 2000, direction: 1 });
        expect(last).toBeLessThanOrEqual(2000);
        expect(frameIndexAt(last, FRAME)).toBe(59);
    });

    it("assumes 30 fps when the video doesn't say", () => {
        const next = stepFrameMs({ ...base, fps: null, currentMs: 0, direction: 1 });
        expect(frameIndexAt(next, FRAME)).toBe(1);
    });
});
