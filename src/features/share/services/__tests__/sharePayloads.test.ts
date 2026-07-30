/* eslint-disable import/first -- jest.mock() must precede the module-under-test import */
// Tests for the share builder's edit detection and the signature helpers that
// power both it and the import screen's "already imported" check. DB access is
// mocked with fixtures for one recipe/log so the pure comparison logic is what
// is under test. Fixtures are `mock`-prefixed so babel-plugin-jest-hoist lets
// the hoisted jest.mock factory reference them.

import { describe, expect, it, jest } from "@jest/globals";
import type { EntryWithFood } from "@/src/features/log/services/logDb";
import type { Food } from "@/src/features/templates/services/templateDb";

const mockChicken: Food = {
    id: 1,
    name: "Chicken",
    calories_per_100g: 100,
    protein_per_100g: 20,
    carbs_per_100g: 0,
    fat_per_100g: 2,
    barcode: null,
    openfoodfacts_id: null,
    source: "manual",
    default_unit: "g",
    serving_size: 100,
    last_logged_amount: null,
    last_logged_unit: null,
    last_logged_meal: null,
    deleted: 0,
    uuid: null,
};
const mockRice: Food = { ...mockChicken, id: 2, name: "Rice", calories_per_100g: 130 };

// Template: 100 g chicken + 100 g rice, per serving.
const mockTemplateItems = [
    { recipe_items: { id: 1, recipe_id: 7, food_id: 1, quantity_grams: 100, quantity_unit: "g", uuid: null }, foods: mockChicken },
    { recipe_items: { id: 2, recipe_id: 7, food_id: 2, quantity_grams: 100, quantity_unit: "g", uuid: null }, foods: mockRice },
];

jest.mock("@/src/features/templates/services/templateDb", () => ({
    getRecipeById: jest.fn(() => ({ id: 7, name: "Stir-Fry", deleted: 0, parent_recipe_id: null, uuid: null })),
    getRecipeItems: jest.fn(() => mockTemplateItems),
    getServingUnits: jest.fn(() => []),
    getFoodByBarcode: jest.fn(),
    getFoodByOpenfoodfactsId: jest.fn(),
    addFood: jest.fn(),
    addRecipe: jest.fn(),
    addRecipeItem: jest.fn(),
    addServingUnit: jest.fn(),
}));
jest.mock("@/src/features/log/services/logDb", () => ({
    addEntry: jest.fn(),
    logRecipeToMeal: jest.fn(),
    getRecipeLogById: jest.fn(() => ({ id: 42, recipe_id: 7, portion: 2, meal_type: "dinner", date: "2026-07-22", timestamp: 0, uuid: null })),
}));

import {
    buildFoodPayload,
    buildLogSelectionPayload,
    findOrCreateFood,
    itemsSignature,
    recipeSignature,
    scaleRecipeItems,
    type LogSharePayload,
    type SharedLogItem,
} from "@/src/features/share/services/sharePayloads";
import * as templateDb from "@/src/features/templates/services/templateDb";

function entry(id: number, foodRow: Food, grams: number): EntryWithFood {
    return {
        entries: {
            id,
            food_id: foodRow.id,
            quantity_grams: grams,
            quantity_unit: "g",
            timestamp: 0,
            date: "2026-07-22",
            meal_type: "dinner",
            recipe_log_id: 42,
            is_scheduled: 0,
            uuid: null,
        },
        foods: foodRow,
    };
}

const recipeItem = (item: SharedLogItem) => (item.type === "recipe" ? item : null);

describe("signature helpers", () => {
    it("itemsSignature is order-independent and rounds grams", () => {
        const a = [
            { food: mockChicken as any, quantity_grams: 100.0004, quantity_unit: "g" },
            { food: mockRice as any, quantity_grams: 200, quantity_unit: "g" },
        ];
        const b = [
            { food: mockRice as any, quantity_grams: 200, quantity_unit: "g" },
            { food: mockChicken as any, quantity_grams: 100, quantity_unit: "g" },
        ];
        expect(itemsSignature(a)).toBe(itemsSignature(b));
    });

    it("recipeSignature distinguishes different compositions but not item order", () => {
        const base = { name: "Stir-Fry", items: [{ food: mockChicken as any, quantity_grams: 100, quantity_unit: "g" }] };
        const more = { name: "Stir-Fry", items: [{ food: mockChicken as any, quantity_grams: 150, quantity_unit: "g" }] };
        expect(recipeSignature(base)).not.toBe(recipeSignature(more));
    });

    it("scaleRecipeItems multiplies grams and guards non-positive portions", () => {
        const scaled = scaleRecipeItems([{ food: mockChicken as any, quantity_grams: 100, quantity_unit: "g" }], 3);
        expect(scaled[0].quantity_grams).toBe(300);
        expect(scaleRecipeItems([{ food: mockChicken as any, quantity_grams: 100, quantity_unit: "g" }], 0)[0].quantity_grams).toBe(100);
    });
});

describe("buildLogSelectionPayload edit detection", () => {
    // portion is 2 (mocked recipe log), so an unedited instance logs 200/200.
    const allRows = [entry(1, mockChicken, 200), entry(2, mockRice, 200)];
    const allIds = new Set([1, 2]);

    it("omits `edited` when the logged entries match template × portion", () => {
        const payload = buildLogSelectionPayload(allRows, allIds, "Priya") as LogSharePayload;
        expect(payload.sharedBy).toBe("Priya");
        const item = recipeItem(payload.items[0]);
        expect(item).not.toBeNull();
        expect(item!.portion).toBe(2);
        expect(item!.edited).toBeUndefined();
    });

    it("captures `edited` with the actual amounts when an entry diverged", () => {
        const edited = [entry(1, mockChicken, 200), entry(2, mockRice, 320)]; // rice bumped from 200
        const payload = buildLogSelectionPayload(edited, allIds) as LogSharePayload;
        const item = recipeItem(payload.items[0])!;
        expect(item.edited).toBeDefined();
        const editedRice = item.edited!.items.find((i) => i.food.name === "Rice")!;
        expect(editedRice.quantity_grams).toBe(320);
    });

    it("falls back to plain food items when a recipe log is only partly selected", () => {
        const payload = buildLogSelectionPayload(allRows, new Set([1]), undefined) as LogSharePayload;
        expect(payload.items).toHaveLength(1);
        expect(payload.items[0].type).toBe("food");
    });
});

// #415: a serving unit knows which unit its amount was stated in, and a share
// has to carry that or the recipient's 250 ml can turns back into "250 g".
describe("serving unit display_unit round-trip", () => {
    // `kind: null` here so this stays a test about display_unit alone; the kind
    // marker gets its own round-trip below.
    const drinkUnits = [
        { id: 5, food_id: 1, name: "serving", grams: 250, display_unit: "ml", kind: null, uuid: null },
        { id: 6, food_id: 1, name: "package", grams: 355, display_unit: null, kind: null, uuid: null },
    ];

    function importedUnits() {
        return jest.mocked(templateDb.addServingUnit).mock.calls.map((call) => call[0]);
    }

    it("sends a ml row's unit and writes it back on import", () => {
        jest.clearAllMocks();
        jest.mocked(templateDb.getServingUnits).mockReturnValueOnce(drinkUnits);
        const payload = buildFoodPayload(mockChicken, "Marco");
        // A grams row sends no unit at all: absent already reads as grams.
        expect(payload.food.serving_units).toEqual([
            { name: "serving", grams: 250, display_unit: "ml" },
            { name: "package", grams: 355 },
        ]);

        jest.mocked(templateDb.addFood).mockReturnValueOnce({ ...mockChicken, id: 9 });
        findOrCreateFood(payload.food);
        expect(importedUnits()).toEqual([
            { food_id: 9, name: "serving", grams: 250, display_unit: "ml", kind: null },
            { food_id: 9, name: "package", grams: 355, display_unit: null, kind: null },
        ]);
    });

    it("falls back to grams for a missing or unrecognised unit", () => {
        jest.clearAllMocks();
        jest.mocked(templateDb.addFood).mockReturnValueOnce({ ...mockChicken, id: 9 });
        findOrCreateFood({
            ...mockChicken,
            serving_units: [
                { name: "scoop", grams: 30, display_unit: "handfuls" },
                { name: "slice", grams: 25 },
            ],
        });
        expect(importedUnits()).toEqual([
            { food_id: 9, name: "scoop", grams: 30, display_unit: null, kind: null },
            { food_id: 9, name: "slice", grams: 25, display_unit: null, kind: null },
        ]);
    });
});

// #414: the kind marker is what makes the OFF serving row identifiable, so a
// shared food has to carry it — otherwise the recipient's copy loses the
// pre-selection that the sender's had.
describe("serving unit kind round-trip", () => {
    const offUnits = [
        { id: 5, food_id: 1, name: "Portion", grams: 30, display_unit: "g", kind: "serving", uuid: null },
        { id: 6, food_id: 1, name: "Packung", grams: 500, display_unit: "g", kind: "package", uuid: null },
        { id: 7, food_id: 1, name: "handful", grams: 20, display_unit: null, kind: null, uuid: null },
    ];

    function importedUnits() {
        return jest.mocked(templateDb.addServingUnit).mock.calls.map((call) => call[0]);
    }

    it("sends each row's kind and writes it back on import", () => {
        jest.clearAllMocks();
        jest.mocked(templateDb.getServingUnits).mockReturnValueOnce(offUnits);
        const payload = buildFoodPayload(mockChicken, "Marco");
        // The hand-added row sends no kind: absent already reads as "not OFF's".
        expect(payload.food.serving_units).toEqual([
            { name: "Portion", grams: 30, display_unit: "g", kind: "serving" },
            { name: "Packung", grams: 500, display_unit: "g", kind: "package" },
            { name: "handful", grams: 20 },
        ]);

        jest.mocked(templateDb.addFood).mockReturnValueOnce({ ...mockChicken, id: 9 });
        findOrCreateFood(payload.food);
        expect(importedUnits()).toEqual([
            { food_id: 9, name: "Portion", grams: 30, display_unit: "g", kind: "serving" },
            { food_id: 9, name: "Packung", grams: 500, display_unit: "g", kind: "package" },
            { food_id: 9, name: "handful", grams: 20, display_unit: null, kind: null },
        ]);
    });

    it("drops a kind it does not recognise, and a missing one", () => {
        jest.clearAllMocks();
        jest.mocked(templateDb.addFood).mockReturnValueOnce({ ...mockChicken, id: 9 });
        findOrCreateFood({
            ...mockChicken,
            serving_units: [
                { name: "scoop", grams: 30, kind: "whole-shelf" },
                { name: "slice", grams: 25 },
            ],
        });
        expect(importedUnits()).toEqual([
            { food_id: 9, name: "scoop", grams: 30, display_unit: null, kind: null },
            { food_id: 9, name: "slice", grams: 25, display_unit: null, kind: null },
        ]);
    });

    // A payload for a plain grams-only food must stay exactly as it was before
    // either column existed, or every recipient sees "not yet imported".
    it("leaves a payload without either marker byte-identical", () => {
        jest.clearAllMocks();
        jest.mocked(templateDb.getServingUnits).mockReturnValueOnce([
            { id: 5, food_id: 1, name: "slice", grams: 25, display_unit: null, kind: null, uuid: null },
        ]);
        expect(JSON.stringify(buildFoodPayload(mockChicken).food.serving_units))
            .toBe('[{"name":"slice","grams":25}]');
    });
});
