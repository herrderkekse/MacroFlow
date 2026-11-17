import { describe, expect, it } from "@jest/globals";
import { fitVideoStage } from "../videoStage";

// A 400 × 700 stage with 100 px of controls; the video is 380 px wide.
const stage = { stageWidth: 400, stageHeight: 700, controlsHeight: 100, sideInset: 10 };

describe("fitVideoStage", () => {
    it("fills the space above the controls until the video's shape is known", () => {
        expect(fitVideoStage({ ...stage, aspect: null })).toEqual({ top: 0, height: 600, underControls: false });
    });

    it("centres a wide video above the controls, as tall as its shape", () => {
        const box = fitVideoStage({ ...stage, aspect: 16 / 9 });
        expect(box.height).toBeCloseTo(380 / (16 / 9));
        expect(box.top).toBeCloseTo((600 - box.height) / 2);
        expect(box.underControls).toBe(false);
    });

    it("lets a taller video reach under the controls", () => {
        // 380 / 0.58 ≈ 655: more than the 600 above the controls, less than the 700 of the stage.
        const box = fitVideoStage({ ...stage, aspect: 0.58 });
        expect(box.top).toBe(0);
        expect(box.height).toBeCloseTo(380 / 0.58);
        expect(box.underControls).toBe(true);
    });

    it("stops at the bottom edge for a video too tall even for that, leaving bars at its sides", () => {
        const box = fitVideoStage({ ...stage, aspect: 9 / 21 });
        expect(box).toEqual({ top: 0, height: 700, underControls: true });
    });
});
