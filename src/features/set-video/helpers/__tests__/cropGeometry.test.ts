import { describe, expect, it } from "@jest/globals";
import { clampShift, clampZoom, cropFrame, cropShare, isWholePicture, MAX_ZOOM, zoomAbout } from "../cropGeometry";

// A portrait phone video's box.
const BOX = { width: 900, height: 1600 };

describe("cropFrame", () => {
    it("is the whole box for the video's own shape", () => {
        expect(cropFrame(BOX, null)).toEqual({ left: 0, top: 0, width: 900, height: 1600 });
    });

    it("fills the width for a wider shape, centred", () => {
        expect(cropFrame(BOX, 1)).toEqual({ left: 0, top: 350, width: 900, height: 900 });
    });

    it("fills the height for a narrower shape, centred", () => {
        const frame = cropFrame({ width: 1600, height: 900 }, 9 / 16);
        expect(frame.height).toBeCloseTo(900);
        expect(frame.width).toBeCloseTo(506.25);
        expect(frame.left).toBeCloseTo((1600 - 506.25) / 2);
    });
});

describe("clampZoom", () => {
    it("never zooms out past the whole video or in past the limit", () => {
        expect(clampZoom(0.5)).toBe(1);
        expect(clampZoom(10)).toBe(MAX_ZOOM);
        expect(clampZoom(2)).toBe(2);
    });
});

describe("clampShift", () => {
    it("can't move an unzoomed video under a frame of its own shape", () => {
        expect(clampShift(BOX, cropFrame(BOX, null), 1, 200, -100)).toEqual({ x: 0, y: 0 });
    });

    it("moves a square frame's video up and down only as far as it reaches", () => {
        const frame = cropFrame(BOX, 1);
        expect(clampShift(BOX, frame, 1, 50, 9999)).toEqual({ x: 0, y: 350 });
        expect(clampShift(BOX, frame, 1, 0, -9999)).toEqual({ x: 0, y: -350 });
    });

    it("lets a zoomed video move sideways by what it grew", () => {
        const frame = cropFrame(BOX, null);
        expect(clampShift(BOX, frame, 2, 9999, 0).x).toBe(450);
    });
});

describe("cropShare", () => {
    it("is the whole picture when nothing is cropped", () => {
        const share = cropShare(BOX, cropFrame(BOX, null), 1, 0, 0);
        expect(share).toEqual({ x: 0, y: 0, width: 1, height: 1 });
        expect(isWholePicture(share)).toBe(true);
    });

    it("is the middle square of a portrait video for a centred square frame", () => {
        const share = cropShare(BOX, cropFrame(BOX, 1), 1, 0, 0);
        expect(share.x).toBe(0);
        expect(share.width).toBe(1);
        expect(share.y).toBeCloseTo(350 / 1600);
        expect(share.height).toBeCloseTo(900 / 1600);
        expect(isWholePicture(share)).toBe(false);
    });

    it("is the top square when the video is moved all the way down", () => {
        const share = cropShare(BOX, cropFrame(BOX, 1), 1, 0, 350);
        expect(share.y).toBeCloseTo(0);
    });

    it("keeps a quarter of the picture at twice the zoom", () => {
        const share = cropShare(BOX, cropFrame(BOX, null), 2, 0, 0);
        expect(share).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
    });

    it("doesn't depend on the box's size, only on its shape", () => {
        const small = { width: 90, height: 160 };
        const a = cropShare(BOX, cropFrame(BOX, 4 / 5), 1.5, 30, -40);
        const b = cropShare(small, cropFrame(small, 4 / 5), 1.5, 3, -4);
        expect(b.x).toBeCloseTo(a.x);
        expect(b.y).toBeCloseTo(a.y);
        expect(b.width).toBeCloseTo(a.width);
    });
});

describe("zoomAbout", () => {
    it("keeps the point under the fingers in place", () => {
        const focus = { x: 700, y: 300 };
        const shift = zoomAbout(BOX, 1, 2, 0, 0, focus.x, focus.y);
        // The picture point under the focus before: at zoom 1 it is the focus itself.
        const before = cropShare(BOX, { left: focus.x, top: focus.y, width: 1, height: 1 }, 1, 0, 0);
        const after = cropShare(BOX, { left: focus.x, top: focus.y, width: 1, height: 1 }, 2, shift.x, shift.y);
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
    });
});
