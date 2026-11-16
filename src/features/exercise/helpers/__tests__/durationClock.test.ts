import { describe, expect, it } from "@jest/globals";
import { clockToFieldValue, durationTargetFor, secondsPerUnit } from "../durationClock";

const field = (id: string, unit: string) => ({ id, name: id, unit, higherIsBetter: true });

describe("secondsPerUnit", () => {
    it("reads common time units in either language", () => {
        expect(secondsPerUnit("s")).toBe(1);
        expect(secondsPerUnit(" Sek. ")).toBe(1);
        expect(secondsPerUnit("min")).toBe(60);
        expect(secondsPerUnit("Minuten")).toBe(60);
        expect(secondsPerUnit("h")).toBe(3600);
    });

    it("rejects units that are not a time", () => {
        expect(secondsPerUnit("cm")).toBeNull();
        expect(secondsPerUnit("")).toBeNull();
        expect(secondsPerUnit("m")).toBeNull();
    });
});

describe("durationTargetFor", () => {
    it("uses a cardio set's duration column", () => {
        expect(durationTargetFor("cardio", [])).toEqual({ kind: "duration" });
    });

    it("uses the first time-unit custom field of an other exercise", () => {
        const fields = [field("reps", ""), field("hold", "min"), field("rest", "s")];
        expect(durationTargetFor("other", fields)).toEqual({ kind: "custom", fieldId: "hold", secondsPerUnit: 60 });
    });

    it("gives no target to exercises without a duration", () => {
        expect(durationTargetFor("weight", [field("t", "s")])).toBeNull();
        expect(durationTargetFor("bodyweight", [])).toBeNull();
        expect(durationTargetFor("other", [field("dist", "cm")])).toBeNull();
    });
});

describe("clockToFieldValue", () => {
    it("writes whole seconds into the duration column", () => {
        expect(clockToFieldValue(61.9, { kind: "duration" })).toBe(61);
    });

    it("converts into a custom unit to one decimal", () => {
        expect(clockToFieldValue(95, { kind: "custom", fieldId: "x", secondsPerUnit: 60 })).toBe(1.6);
        expect(clockToFieldValue(42, { kind: "custom", fieldId: "x", secondsPerUnit: 1 })).toBe(42);
    });
});
