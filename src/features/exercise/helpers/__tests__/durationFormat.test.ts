import { describe, expect, it } from "@jest/globals";
import { digitsToClockText, formatDuration, parseDuration } from "../durationFormat";

describe("formatDuration", () => {
    it("shows minutes and seconds under an hour", () => {
        expect(formatDuration(0)).toBe("0:00");
        expect(formatDuration(45)).toBe("0:45");
        expect(formatDuration(1860)).toBe("31:00");
        expect(formatDuration(3599)).toBe("59:59");
    });

    it("adds hours from an hour on", () => {
        expect(formatDuration(3600)).toBe("1:00:00");
        expect(formatDuration(3723)).toBe("1:02:03");
        expect(formatDuration(36000)).toBe("10:00:00");
    });
});

describe("digitsToClockText", () => {
    it("fills the clock from the right", () => {
        expect(digitsToClockText("1")).toBe("0:01");
        expect(digitsToClockText("130")).toBe("1:30");
        expect(digitsToClockText("3100")).toBe("31:00");
        expect(digitsToClockText("13000")).toBe("1:30:00");
        expect(digitsToClockText("")).toBe("");
    });

    it("keeps a clock text's value", () => {
        expect(digitsToClockText("1:30")).toBe("1:30");
        expect(digitsToClockText("1:02:03")).toBe("1:02:03");
        expect(digitsToClockText("0:45")).toBe("0:45");
    });

    it("rejects more digits than allowed", () => {
        expect(digitsToClockText("1234567")).toBeNull();
        expect(digitsToClockText("12345", 4)).toBeNull();
    });
});

describe("parseDuration", () => {
    it("reads clock texts and bare seconds", () => {
        expect(parseDuration("1:30")).toBe(90);
        expect(parseDuration("1:02:03")).toBe(3723);
        expect(parseDuration("1:90")).toBe(150);
        expect(parseDuration("75")).toBe(75);
    });

    it("rejects anything else", () => {
        expect(parseDuration("")).toBeNull();
        expect(parseDuration("1:")).toBeNull();
        expect(parseDuration("a")).toBeNull();
        expect(parseDuration("1:2:3:4")).toBeNull();
    });

    it("reads back what it formats", () => {
        for (const s of [0, 59, 61, 3599, 3600, 7322]) expect(parseDuration(formatDuration(s))).toBe(s);
    });
});
