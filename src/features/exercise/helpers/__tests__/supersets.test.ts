import { describe, expect, it } from "@jest/globals";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../../services/exerciseDb";
import {
    activeRowIndex,
    groupIntoCards,
    nextAddTarget,
    orderSupersetRows,
} from "../supersets";

// Minimal fixtures — only the fields the pure helpers read are populated.
// `orders` overrides each set's set_order (defaults to 1..n, i.e. a fresh superset).
function ex(id: number, group: string | null, setCount: number, completed = 0, orders?: number[]): WorkoutExerciseWithSets {
    const sets = Array.from({ length: setCount }, (_, i) => ({
        id: id * 100 + i,
        set_order: orders?.[i] ?? i + 1,
        completed_at: i < completed ? Date.now() : null,
    })) as ExerciseSet[];
    return {
        workoutExercise: { id, superset_group: group } as WorkoutExerciseWithSets["workoutExercise"],
        workout: {} as WorkoutExerciseWithSets["workout"],
        exerciseTemplate: null,
        sets,
    };
}

describe("groupIntoCards", () => {
    it("keeps standalone exercises as single cards", () => {
        const cards = groupIntoCards([ex(1, null, 2), ex(2, null, 1)]);
        expect(cards.map((c) => c.isSuperset)).toEqual([false, false]);
        expect(cards).toHaveLength(2);
    });

    it("collapses two exercises sharing a group into one superset card", () => {
        const cards = groupIntoCards([ex(1, "g1", 3), ex(2, "g1", 2), ex(3, null, 1)]);
        expect(cards).toHaveLength(2);
        expect(cards[0].isSuperset).toBe(true);
        expect(cards[0].members.map((m) => m.workoutExercise.id)).toEqual([1, 2]);
        expect(cards[1].isSuperset).toBe(false);
    });

    it("groups by first appearance even when members are not adjacent", () => {
        const cards = groupIntoCards([ex(1, "g1", 1), ex(3, null, 1), ex(2, "g1", 1)]);
        expect(cards).toHaveLength(2);
        expect(cards[0].isSuperset).toBe(true);
        expect(cards[0].members.map((m) => m.workoutExercise.id)).toEqual([1, 2]);
    });

    it("demotes a group left with a single member back to a normal card", () => {
        const cards = groupIntoCards([ex(1, "g1", 2)]);
        expect(cards[0].isSuperset).toBe(false);
    });
});

describe("orderSupersetRows", () => {
    it("reads as A1, B1, A2, … for a fresh superset (equal set_orders)", () => {
        const rows = orderSupersetRows([ex(1, "g1", 3), ex(2, "g1", 2)]);
        expect(rows.map((r) => [r.memberIndex, r.withinIndex])).toEqual([
            [0, 0], [1, 0],
            [0, 1], [1, 1],
            [0, 2],
        ]);
    });

    it("respects a custom global set_order after reordering", () => {
        // A sets at order 1,4; B sets at 2,3 → A1, B1, B2, A2
        const rows = orderSupersetRows([ex(1, "g1", 2, 0, [1, 4]), ex(2, "g1", 2, 0, [2, 3])]);
        expect(rows.map((r) => [r.memberIndex, r.withinIndex])).toEqual([
            [0, 0], [1, 0], [1, 1], [0, 1],
        ]);
    });

    it("handles an empty superset without throwing", () => {
        expect(orderSupersetRows([ex(1, "g1", 0), ex(2, "g1", 0)])).toEqual([]);
    });
});

describe("nextAddTarget", () => {
    it("targets the member with fewer sets, ties going to the base", () => {
        expect(nextAddTarget([ex(1, "g1", 2), ex(2, "g1", 2)])).toBe(0);
        expect(nextAddTarget([ex(1, "g1", 3), ex(2, "g1", 2)])).toBe(1);
        expect(nextAddTarget([ex(1, "g1", 1), ex(2, "g1", 3)])).toBe(0);
    });
});

describe("activeRowIndex", () => {
    it("finds the first uncompleted row in interleaved order", () => {
        const rows = orderSupersetRows([ex(1, "g1", 2, 2), ex(2, "g1", 2, 1)]);
        // A0✓ B0✓ A1✓ B1 → first uncompleted is index 3
        expect(activeRowIndex(rows)).toBe(3);
    });

    it("returns -1 when everything is done", () => {
        const rows = orderSupersetRows([ex(1, "g1", 1, 1), ex(2, "g1", 1, 1)]);
        expect(activeRowIndex(rows)).toBe(-1);
    });
});
