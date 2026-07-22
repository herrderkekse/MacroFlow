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
    buildLogSelectionPayload,
    itemsSignature,
    recipeSignature,
    scaleRecipeItems,
    type LogSharePayload,
    type SharedLogItem,
} from "@/src/features/share/services/sharePayloads";

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
