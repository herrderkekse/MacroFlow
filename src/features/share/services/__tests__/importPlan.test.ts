/* eslint-disable import/first -- jest.mock() must precede the module-under-test import */
// Unit tests for the import decision engine. The DB-owning modules are mocked
// so these run as pure logic — no expo-sqlite, no native. `getAllRecipes`
// returns an empty library by default (nothing "already imported"); the skip
// rule is exercised directly via `needsTemplatePhase`.

import { describe, expect, it, jest } from "@jest/globals";
import type { FetchedShare } from "@/src/features/share/services/shareClient";
import type { RecipeSharePayload, SharedFood } from "@/src/features/share/services/sharePayloads";

jest.mock("@/src/features/templates/services/templateDb", () => ({
    getAllRecipes: jest.fn(() => []),
    getRecipeById: jest.fn(),
    getRecipeItems: jest.fn(() => []),
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
    getRecipeLogById: jest.fn(),
    logRecipeToMeal: jest.fn(),
}));

import {
    buildImportQueue,
    computeMacros,
    diffItems,
    formatGrams,
    logFoodDecision,
    needsTemplatePhase,
    saveFoodDecision,
    saveTemplateDecision,
    skipDecision,
    summarizeDecisions,
    type Decision,
    type RecipeSlide,
} from "@/src/features/share/services/importPlan";

function food(name: string, cals = 100, over: Partial<SharedFood> = {}): SharedFood {
    return {
        name,
        calories_per_100g: cals,
        protein_per_100g: 10,
        carbs_per_100g: 20,
        fat_per_100g: 5,
        serving_size: 100,
        ...over,
    };
}

function share(kind: FetchedShare["kind"], payload: unknown): FetchedShare {
    return { kind, version: 2, payload, createdAt: 0 };
}

describe("computeMacros", () => {
    it("sums per-100g macros scaled by grams", () => {
        const m = computeMacros([
            { food: food("A", 200), quantity_grams: 200, quantity_unit: "g" }, // 400 cal
            { food: food("B", 100), quantity_grams: 50, quantity_unit: "g" }, // 50 cal
        ]);
        expect(m.calories).toBe(450);
        expect(m.protein).toBe(25); // 10/100 * (200+50)
    });

    it("returns zeroes for an empty recipe", () => {
        expect(computeMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    });
});

describe("diffItems", () => {
    it("classifies added / removed / changed / same", () => {
        const base = [
            { food: food("Chicken"), quantity_grams: 100, quantity_unit: "g" },
            { food: food("Rice"), quantity_grams: 200, quantity_unit: "g" },
            { food: food("Oil"), quantity_grams: 10, quantity_unit: "g" },
        ];
        const edited = [
            { food: food("Chicken"), quantity_grams: 100, quantity_unit: "g" }, // same
            { food: food("Rice"), quantity_grams: 300, quantity_unit: "g" }, // changed
            { food: food("Cashews"), quantity_grams: 40, quantity_unit: "g" }, // added
            // Oil removed
        ];
        const rows = diffItems(base, edited);
        const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
        expect(byName.Chicken.type).toBe("same");
        expect(byName.Rice.type).toBe("changed");
        expect(byName.Rice.qtyText).toBe("200 g → 300 g");
        expect(byName.Cashews.type).toBe("added");
        expect(byName.Oil.type).toBe("removed");
    });
});

describe("formatGrams", () => {
    it("rounds to whole grams", () => {
        expect(formatGrams(199.6)).toBe("200 g");
    });
});

describe("buildImportQueue", () => {
    it("puts a single shared food into one batch slide, defaulting to library-only", () => {
        const q = buildImportQueue(share("food", { food: food("Almonds"), sharedBy: "Marco" }));
        expect(q.sharedBy).toBe("Marco");
        expect(q.slides).toHaveLength(1);
        const slide = q.slides[0];
        expect(slide.type).toBe("foods");
        if (slide.type !== "foods") throw new Error("expected foods slide");
        expect(slide.foods[0].fromLog).toBe(false); // bare template -> not from a log
    });

    it("makes one slide per shared recipe and one combined foods slide", () => {
        const payload = {
            sharedBy: "Priya",
            items: [
                { type: "recipe", recipe: { name: "Stir-Fry", items: [{ food: food("Chicken"), quantity_grams: 100, quantity_unit: "g" }] }, portion: 1, meal_type: "dinner" },
                { type: "food", food: food("Yogurt"), quantity_grams: 170, quantity_unit: "g", meal_type: "breakfast" },
                { type: "food", food: food("Almonds"), quantity_grams: 30, quantity_unit: "g", meal_type: "snack" },
            ],
        };
        const q = buildImportQueue(share("log", payload));
        expect(q.slides.filter((s) => s.type === "recipe")).toHaveLength(1);
        const foodsSlides = q.slides.filter((s) => s.type === "foods");
        expect(foodsSlides).toHaveLength(1);
        if (foodsSlides[0].type !== "foods") throw new Error("expected foods slide");
        expect(foodsSlides[0].foods).toHaveLength(2); // both foods condensed into one slide
    });

    it("flags an edited recipe log and diffs against the template × portion", () => {
        const baseItems = [
            { food: food("Chicken"), quantity_grams: 100, quantity_unit: "g" },
            { food: food("Rice"), quantity_grams: 100, quantity_unit: "g" },
        ];
        const payload = {
            items: [
                {
                    type: "recipe",
                    recipe: { name: "Stir-Fry", items: baseItems },
                    portion: 2,
                    meal_type: "dinner",
                    // base×2 would be 200/200; the edit bumps rice to 300
                    edited: {
                        name: "Stir-Fry",
                        items: [
                            { food: food("Chicken"), quantity_grams: 200, quantity_unit: "g" },
                            { food: food("Rice"), quantity_grams: 300, quantity_unit: "g" },
                        ],
                    },
                },
            ],
        };
        const q = buildImportQueue(share("log", payload));
        const slide = q.slides[0] as RecipeSlide;
        expect(slide.isEdited).toBe(true);
        expect(slide.isEntry).toBe(true);
        expect(slide.portion).toBe(2);
        const rice = slide.diff.find((r) => r.name === "Rice")!;
        expect(rice.type).toBe("changed");
        expect(rice.qtyText).toBe("200 g → 300 g"); // template(100)×2 → edited 300
        expect(slide.diffSummary.changed).toBe(1);
    });

    it("treats a bare recipe share as a single non-entry template slide", () => {
        const recipe: RecipeSharePayload = { name: "Oats", items: [{ food: food("Oats"), quantity_grams: 60, quantity_unit: "g" }] };
        const q = buildImportQueue(share("recipe", recipe));
        const slide = q.slides[0] as RecipeSlide;
        expect(slide.isEntry).toBe(false);
        expect(slide.isEdited).toBe(false);
        expect(slide.portion).toBe(1);
    });
});

describe("needsTemplatePhase (the skip rule)", () => {
    const slide = {
        originalImported: false,
        editedImported: false,
        originalSig: "sig-original",
        editedSig: "sig-edited",
    } as RecipeSlide;

    it("requires the template step when neither version exists yet", () => {
        expect(needsTemplatePhase(slide, new Set())).toBe(true);
    });

    it("still requires it when only one version exists", () => {
        expect(needsTemplatePhase(slide, new Set(["sig-original"]))).toBe(true);
        expect(needsTemplatePhase(slide, new Set(["sig-edited"]))).toBe(true);
    });

    it("skips the template step when BOTH versions are already imported", () => {
        expect(needsTemplatePhase(slide, new Set(["sig-original", "sig-edited"]))).toBe(false);
    });

    it("counts library snapshots, not just this session", () => {
        const inLibrary = { ...slide, originalImported: true, editedImported: true } as RecipeSlide;
        expect(needsTemplatePhase(inLibrary, new Set())).toBe(false);
    });
});

describe("decisions and summary", () => {
    it("buckets a logged food as an item and a template-only food as a template", () => {
        const item = { id: "f1", food: food("A"), title: "A", grams: 100, unit: "g", macros: computeMacros([]), fromLog: true, meal: "lunch" };
        expect(logFoodDecision(item, "2026-07-22", "Wed, Jul 22", "lunch").bucket).toBe("item");
        expect(saveFoodDecision(item).bucket).toBe("template");
    });

    it("buckets an edited-template save distinctly from the original", () => {
        const slide = { id: "r1", title: "Stir-Fry", base: {}, edited: {} } as unknown as RecipeSlide;
        expect(saveTemplateDecision(slide, false).summaryKey).toBe("share.import.outcomeSavedTemplate");
        expect(saveTemplateDecision(slide, true).summaryKey).toBe("share.import.outcomeSavedEdited");
    });

    it("tallies templates / items / skipped", () => {
        const decisions: Decision[] = [
            { key: "a", title: "A", bucket: "template", summaryKey: "", icon: "", tone: "primary" },
            { key: "b", title: "B", bucket: "item", summaryKey: "", icon: "", tone: "success" },
            { key: "c", title: "C", bucket: "item", summaryKey: "", icon: "", tone: "success" },
            skipDecision("d", "D"),
        ];
        expect(summarizeDecisions(decisions)).toEqual({ templates: 1, items: 2, skipped: 1 });
    });
});
