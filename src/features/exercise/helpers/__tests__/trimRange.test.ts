import { describe, expect, it } from "@jest/globals";
import { formatClipTime, isWholeVideo, MIN_CLIP_MS, moveTrimEnd, moveTrimStart } from "../trimRange";

describe("moveTrimStart", () => {
    it("follows the drag inside the range", () => {
        expect(moveTrimStart(2000, 10000)).toBe(2000);
    });

    it("stops at the beginning of the video", () => {
        expect(moveTrimStart(-300, 10000)).toBe(0);
    });

    it("keeps the shortest clip before the end", () => {
        expect(moveTrimStart(9900, 10000)).toBe(10000 - MIN_CLIP_MS);
    });

    it("stays at 0 when the video is shorter than the shortest clip", () => {
        expect(moveTrimStart(100, 300)).toBe(0);
    });
});

describe("moveTrimEnd", () => {
    it("follows the drag inside the range", () => {
        expect(moveTrimEnd(8000, 2000, 10000)).toBe(8000);
    });

    it("stops at the end of the video", () => {
        expect(moveTrimEnd(12000, 0, 10000)).toBe(10000);
    });

    it("keeps the shortest clip after the start", () => {
        expect(moveTrimEnd(2100, 2000, 10000)).toBe(2000 + MIN_CLIP_MS);
    });

    it("stays at the end when the video is shorter than the shortest clip", () => {
        expect(moveTrimEnd(0, 0, 300)).toBe(300);
    });
});

describe("isWholeVideo", () => {
    it("is true only when both ends are untouched", () => {
        expect(isWholeVideo(0, 10000, 10000)).toBe(true);
        expect(isWholeVideo(100, 10000, 10000)).toBe(false);
        expect(isWholeVideo(0, 9900, 10000)).toBe(false);
    });
});

describe("formatClipTime", () => {
    it("shows minutes, seconds and tenths", () => {
        expect(formatClipTime(0)).toBe("0:00.0");
        expect(formatClipTime(3240)).toBe("0:03.2");
        expect(formatClipTime(65_000)).toBe("1:05.0");
        expect(formatClipTime(725_000)).toBe("12:05.0");
    });

    it("rounds to the nearest tenth, carrying into the next second", () => {
        expect(formatClipTime(59_960)).toBe("1:00.0");
    });
});
