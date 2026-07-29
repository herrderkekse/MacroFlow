/* eslint-disable import/first -- jest.mock() must precede the module-under-test import */
// Tests for the Search-a-licious search path: hit → OFFProduct mapping, the
// retry on a server-side failure, and the rule that only a *successful* search
// spends a slot of the client-side rate-limit budget. `fetch` is the seam; i18n
// is stubbed to return the key so assertions can match on it.

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/src/i18n", () => ({
    __esModule: true,
    default: {
        language: "de",
        t: (key: string) => key,
    },
}));

jest.mock("@/src/utils/logger", () => ({
    __esModule: true,
    default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
    hydrateProduct,
    isObsolete,
    productName,
    productNutrition,
    productToFood,
    searchProducts,
    type OFFProduct,
} from "@/src/services/openfoodfacts";

type FetchMock = jest.Mock<(url: string, init?: unknown) => Promise<unknown>>;

function jsonResponse(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function searchHits(hits: unknown[]) {
    return jsonResponse({ hits, page: 1, page_size: 20, page_count: 1 });
}

let fetchMock: FetchMock;
// The rate-limit window is module state, so every test starts on a clock far
// enough ahead that the previous test's timestamps have aged out of it.
let clock = Date.now();

beforeEach(() => {
    fetchMock = jest.fn() as FetchMock;
    (global as { fetch?: unknown }).fetch = fetchMock;
    jest.useFakeTimers();
    clock += 120_000;
    jest.setSystemTime(clock);
});

afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
});

/** The retry sleeps, so pending timers have to be flushed while the call is in flight. */
async function withTimersFlushed<T>(promise: Promise<T>): Promise<T> {
    const settled = promise.catch((err: unknown) => ({ __error: err }));
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
        jest.runOnlyPendingTimers();
    }
    const result = (await settled) as T | { __error: unknown };
    if (result && typeof result === "object" && "__error" in result) throw result.__error;
    return result as T;
}

function lastUrl(): string {
    return String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0]);
}

describe("searchProducts", () => {
    it("queries Search-a-licious with the app language first and English as fallback", async () => {
        fetchMock.mockResolvedValue(searchHits([]));

        await withTimersFlushed(searchProducts("milch"));

        const url = new URL(lastUrl());
        expect(url.origin + url.pathname).toBe("https://search.openfoodfacts.org/search");
        expect(url.searchParams.get("q")).toBe("milch");
        expect(url.searchParams.get("langs")).toBe("de,en");
        expect(url.searchParams.get("page")).toBe("1");
        expect(url.searchParams.get("fields")).toContain("product_name_de");
        expect(url.searchParams.get("fields")).toContain("brands");
        expect(url.searchParams.get("fields")).toContain("nutriments");
    });

    // The localized names stay as the keys they came as: `productName` picks
    // one, so that the search list and the import cannot disagree (#401).
    it("maps hits to products, keeping every localized name", async () => {
        fetchMock.mockResolvedValue(
            searchHits([
                {
                    code: "1",
                    product_name: "Whole milk",
                    product_name_de: "Vollmilch",
                    brands: ["Weihenstephan", " Müller"],
                    quantity: "1 l",
                    nutriments: { "energy-kcal_100g": 64, proteins_100g: 3.4 },
                },
                { code: "2", product_name: "Skyr" },
            ]),
        );

        const products = await withTimersFlushed(searchProducts("milch"));

        expect(products).toEqual([
            {
                code: "1",
                product_name: "Whole milk",
                product_name_de: "Vollmilch",
                brands: ["Weihenstephan", " Müller"],
                quantity: "1 l",
                nutriments: { "energy-kcal_100g": 64, proteins_100g: 3.4 },
                obsolete: false,
            },
            {
                code: "2",
                product_name: "Skyr",
                brands: undefined,
                quantity: undefined,
                nutriments: undefined,
                obsolete: false,
            },
        ]);
        expect(products.map((p) => productName(p, "Unknown"))).toEqual([
            "Weihenstephan Vollmilch",
            "Skyr",
        ]);
    });

    // A product OFF only knows a German name for still has a name.
    it("keeps a hit whose only name is a localized one", async () => {
        fetchMock.mockResolvedValue(searchHits([{ code: "1", product_name_de: "Vollmilch" }]));

        const products = await withTimersFlushed(searchProducts("milch"));

        expect(products.map((p) => productName(p, "Unknown"))).toEqual(["Vollmilch"]);
    });

    // The index only sets `obsolete` on delisted products, and they are not
    // filtered out — the UI flags them instead of hiding them.
    it("carries the obsolete flag through from the index", async () => {
        fetchMock.mockResolvedValue(
            searchHits([
                { code: "1", product_name: "Discontinued", obsolete: true },
                { code: "2", product_name: "Current" },
            ]),
        );

        const products = await withTimersFlushed(searchProducts("milch"));

        expect(products.map(isObsolete)).toEqual([true, false]);
    });

    it("drops hits without a code or a name", async () => {
        fetchMock.mockResolvedValue(
            searchHits([{ code: "1" }, { product_name: "No code" }, { code: "2", product_name: "Ok" }]),
        );

        const products = await withTimersFlushed(searchProducts("milch"));

        expect(products.map((p) => p.code)).toEqual(["2"]);
    });

    it("retries once on a server error and returns the retried results", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({}, 503))
            .mockResolvedValueOnce(searchHits([{ code: "1", product_name: "Milch" }]));

        const products = await withTimersFlushed(searchProducts("milch"));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(products.map((p) => p.code)).toEqual(["1"]);
    });

    it("retries once on a network error", async () => {
        fetchMock
            .mockRejectedValueOnce(new Error("Network request failed"))
            .mockResolvedValueOnce(searchHits([{ code: "1", product_name: "Milch" }]));

        const products = await withTimersFlushed(searchProducts("milch"));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(products).toHaveLength(1);
    });

    it("does not retry a 4xx", async () => {
        fetchMock.mockResolvedValue(jsonResponse({}, 422));

        await expect(withTimersFlushed(searchProducts("milch"))).rejects.toThrow(
            "common.searchFailedHttp",
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reports a persistent server error as unavailable", async () => {
        fetchMock.mockResolvedValue(jsonResponse({}, 503));

        await expect(withTimersFlushed(searchProducts("milch"))).rejects.toThrow(
            "common.openFoodFactsUnavailable",
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not spend rate-limit budget on failed searches", async () => {
        fetchMock.mockResolvedValue(jsonResponse({}, 503));
        for (let i = 0; i < 12; i++) {
            await expect(withTimersFlushed(searchProducts("milch"))).rejects.toThrow(
                "common.openFoodFactsUnavailable",
            );
        }

        // A dozen failures must leave the whole budget intact.
        fetchMock.mockResolvedValue(searchHits([{ code: "1", product_name: "Milch" }]));
        for (let i = 0; i < 10; i++) {
            await expect(withTimersFlushed(searchProducts("milch"))).resolves.toHaveLength(1);
        }
    });

    it("rate-limits once the window is full of successful searches", async () => {
        fetchMock.mockResolvedValue(searchHits([{ code: "1", product_name: "Milch" }]));
        for (let i = 0; i < 10; i++) await withTimersFlushed(searchProducts("milch"));

        await expect(withTimersFlushed(searchProducts("milch"))).rejects.toThrow(
            "common.rateLimitedWait",
        );

        // …and frees up again once the sliding window has passed.
        jest.setSystemTime(Date.now() + 61_000);
        await expect(withTimersFlushed(searchProducts("milch"))).resolves.toHaveLength(1);
    });
});

// #400: an unchecked `?? 0` turned every partial OFF payload into a plausible
// 0 kcal food. Energy is the gate — everything here is about which figures a
// product really carries and when there are none.
describe("productNutrition", () => {
    it("reads the as-sold per-100 g figures", () => {
        expect(
            productNutrition({
                nutriments: {
                    "energy-kcal_100g": 42,
                    proteins_100g: 0,
                    carbohydrates_100g: 10.6,
                    fat_100g: 0,
                },
            }),
        ).toEqual({
            calories_per_100g: 42,
            protein_per_100g: 0,
            carbs_per_100g: 10.6,
            fat_per_100g: 0,
            prepared: false,
        });
    });

    it("returns null when the product carries no energy figure at all", () => {
        expect(productNutrition({})).toBeNull();
        expect(productNutrition({ nutriments: {} })).toBeNull();
        expect(productNutrition({ nutriments: { proteins_100g: 3.4 } })).toBeNull();
    });

    it("honours no_nutrition_data even when nutriments are present", () => {
        expect(
            productNutrition({
                no_nutrition_data: "on",
                nutriments: { "energy-kcal_100g": 42 },
            }),
        ).toBeNull();
    });

    // A real zero — water, diet soda — is data, not a missing value.
    it("keeps an explicit zero", () => {
        expect(productNutrition({ nutriments: { "energy-kcal_100g": 0 } })).toMatchObject({
            calories_per_100g: 0,
        });
    });

    // Plenty of EU products publish only the kilojoule figure, which used to
    // read as 0 kcal even with every macro filled in.
    it("derives kcal from the kJ figure when kcal is absent", () => {
        expect(
            productNutrition({
                nutriments: { "energy-kj_100g": 647, proteins_100g: 13.1, fat_100g: 11.2 },
            }),
        ).toMatchObject({ calories_per_100g: 154.64, protein_per_100g: 13.1 });
    });

    it("scales per-serving figures to per 100 g when only those exist", () => {
        expect(
            productNutrition({
                serving_quantity: 330,
                nutriments: { "energy-kcal_serving": 139, carbohydrates_serving: 35 },
            }),
        ).toEqual({
            calories_per_100g: 42.12,
            protein_per_100g: 0,
            carbs_per_100g: 10.61,
            fat_per_100g: 0,
            prepared: false,
        });
    });

    // Without the serving mass there is no way to normalize, so it is a gap
    // rather than a number to guess at.
    it("refuses per-serving figures when the serving mass is unknown", () => {
        expect(
            productNutrition({ nutriments: { "energy-kcal_serving": 139 } }),
        ).toBeNull();
        expect(
            productNutrition({
                serving_quantity: 0,
                nutriments: { "energy-kcal_serving": 139 },
            }),
        ).toBeNull();
    });

    // `serving_size`/`default_unit` describe the pack, so as-sold figures have
    // to win — pairing a dry scoop with made-up-drink numbers underprices it.
    it("prefers as-sold figures over prepared ones", () => {
        expect(
            productNutrition({
                nutriments: {
                    "energy-kcal_100g": 377,
                    "energy-kcal_prepared_100g": 72,
                },
            }),
        ).toMatchObject({ calories_per_100g: 377, prepared: false });
    });

    it("falls back to prepared figures when there are no as-sold ones", () => {
        expect(
            productNutrition({
                nutriments: {
                    "energy-kcal_prepared_100g": 72,
                    proteins_prepared_100g: 3.6,
                    carbohydrates_prepared_100g: 9.8,
                    fat_prepared_100g: 1.8,
                },
            }),
        ).toEqual({
            calories_per_100g: 72,
            protein_per_100g: 3.6,
            carbs_per_100g: 9.8,
            fat_per_100g: 1.8,
            prepared: true,
        });
    });
});

// #401: `product_name` is whatever language the product itself is in, and no
// request parameter makes v2 localize it. The app language is stubbed to "de"
// above, so the chain under test is product_name_de → product_name_en →
// product_name.
describe("productName", () => {
    const name = (product: OFFProduct) => productName(product, "Unknown");

    it("prefers the app language, then English, then the product's own name", () => {
        const product = {
            code: "1",
            product_name: "PESTO alla GENOVESE",
            product_name_en: "Green pesto",
            product_name_de: "Grünes Pesto alla Genovese",
        };

        expect(name(product)).toBe("Grünes Pesto alla Genovese");
        expect(name({ ...product, product_name_de: undefined })).toBe("Green pesto");
        expect(name({ ...product, product_name_de: "", product_name_en: "" })).toBe(
            "PESTO alla GENOVESE",
        );
    });

    it("falls back to the given name when OFF has none", () => {
        expect(name({ code: "1" })).toBe("Unknown");
        expect(name({ code: "1", product_name: "   " })).toBe("Unknown");
    });

    it("prefixes the brand so near-identical products can be told apart", () => {
        expect(name({ code: "1", product_name_de: "Grünes Pesto", brands: "Barilla" })).toBe(
            "Barilla Grünes Pesto",
        );
    });

    // `brands` is a list with the owner first, and the tail is often an address
    // OFF split on its own commas. The product API sends it as one string, the
    // search index as an array — both have to read the same.
    it("uses only the first brand, however the endpoint shaped the list", () => {
        expect(name({ code: "1", product_name: "Pesto", brands: "Barilla,43122 Parma - Italy" })).toBe(
            "Barilla Pesto",
        );
        expect(name({ code: "1", product_name: "Pesto", brands: ["Barilla", " Italien"] })).toBe(
            "Barilla Pesto",
        );
    });

    it("ignores an empty brand list", () => {
        expect(name({ code: "1", product_name: "Pesto", brands: [] })).toBe("Pesto");
        expect(name({ code: "1", product_name: "Pesto", brands: "" })).toBe("Pesto");
    });

    it("leaves a name that already carries the brand alone", () => {
        expect(name({ code: "1", product_name: "Nutella", brands: "Nutella,Ferrero" })).toBe(
            "Nutella",
        );
        expect(name({ code: "1", product_name: "coca-cola", brands: "Coca-Cola" })).toBe(
            "coca-cola",
        );
    });

    it("stands in the brand for a product with no name at all", () => {
        expect(name({ code: "1", brands: "Barilla" })).toBe("Barilla");
    });
});

describe("productToFood", () => {
    const opts = { fallbackName: "Unknown" };
    const nutriments = {
        "energy-kcal_100g": 42,
        proteins_100g: 0,
        carbohydrates_100g: 10.6,
        fat_100g: 0,
    };

    /** Narrow to the success case; every field assertion below needs the food. */
    function foodFrom(product: OFFProduct) {
        const imported = productToFood(product, opts);
        if (!imported.ok) throw new Error(`expected an importable product, got ${imported.reason}`);
        return imported.food;
    }

    it("maps every food field an OFF product carries", () => {
        expect(
            foodFrom({
                code: "5449000000996",
                product_name: "Coca-Cola",
                serving_size: "330 ml",
                serving_quantity: 330,
                nutriments,
            }),
        ).toEqual({
            name: "Coca-Cola",
            calories_per_100g: 42,
            protein_per_100g: 0,
            carbs_per_100g: 10.6,
            fat_per_100g: 0,
            barcode: "5449000000996",
            openfoodfacts_id: "5449000000996",
            source: "openfoodfacts",
            default_unit: "ml",
            serving_size: 330,
        });
    });

    // The bug behind #399: a scanned product and a searched one are the same
    // OFF record, so they have to produce the same food.
    it("does not depend on how the product was found", () => {
        const product = { code: "1", product_name: "Vollmilch", quantity: "1 l", nutriments };

        expect(productToFood(product, opts)).toEqual(productToFood({ ...product }, opts));
    });

    it("fills barcode from the product code, which is the EAN", () => {
        expect(foodFrom({ code: "1", product_name: "Milch", nutriments })).toMatchObject({
            barcode: "1",
            openfoodfacts_id: "1",
        });
    });

    it("falls back to the given name", () => {
        expect(foodFrom({ code: "1", nutriments })).toMatchObject({ name: "Unknown" });
    });

    // The name a user picked in the search list is the name they get (#401).
    it("imports the localized, brand-prefixed name", () => {
        expect(
            foodFrom({
                code: "8076809513753",
                product_name: "PESTO alla GENOVESE",
                product_name_de: "Grünes Pesto alla Genovese",
                brands: "Barilla",
                nutriments,
            }),
        ).toMatchObject({ name: "Barilla Grünes Pesto alla Genovese" });
    });

    // The heart of #400: no numbers means no food, and the caller gets what it
    // needs to open manual entry instead of writing a 0 kcal row.
    it("refuses a product with no nutrition facts, keeping name and barcode", () => {
        expect(productToFood({ code: "737628064502", product_name: "Tisane" }, opts)).toEqual({
            ok: false,
            reason: "no-nutrition-data",
            name: "Tisane",
            barcode: "737628064502",
        });
    });

    it("reports whether the figures describe the prepared product", () => {
        expect(productToFood({ code: "1", nutriments }, opts)).toMatchObject({ prepared: false });
        expect(
            productToFood({ code: "1", nutriments: { "energy-kcal_prepared_100g": 72 } }, opts),
        ).toMatchObject({ prepared: true });
    });

    it("prefers serving_quantity, then a number parsed out of serving_size, then 100 g", () => {
        const size = (product: OFFProduct) => foodFrom({ ...product, nutriments }).serving_size;

        expect(size({ code: "1", serving_size: "250 ml", serving_quantity: 330 })).toBe(330);
        expect(size({ code: "1", serving_size: "250 ml" })).toBe(250);
        expect(size({ code: "1", serving_size: "one scoop" })).toBe(100);
        expect(size({ code: "1" })).toBe(100);
    });

    it("guesses the unit from serving_size, else quantity, else grams", () => {
        const unit = (product: OFFProduct) => foodFrom({ ...product, nutriments }).default_unit;

        expect(unit({ code: "1", serving_size: "330 ml", quantity: "1 kg" })).toBe("ml");
        expect(unit({ code: "1", quantity: "500 ml" })).toBe("ml");
        expect(unit({ code: "1", quantity: "1 liter" })).toBe("ml");
        expect(unit({ code: "1", serving_size: "1 cup" })).toBe("cup");
        expect(unit({ code: "1", serving_size: "2 tbsp" })).toBe("tbsp");
        expect(unit({ code: "1", serving_size: "8 fl oz" })).toBe("fl_oz");
        expect(unit({ code: "1", serving_size: "30 g" })).toBe("g");
        expect(unit({ code: "1" })).toBe("g");
    });
});

describe("hydrateProduct", () => {
    const hit: OFFProduct = {
        code: "1",
        product_name: "Whole milk",
        product_name_de: "Vollmilch",
        quantity: "1 l",
    };

    it("merges in everything the search index does not carry", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({
                status: 1,
                code: "1",
                product: {
                    code: "1",
                    product_name: "Whole milk",
                    product_name_de: "Vollmilch",
                    brands: "Weihenstephan",
                    serving_size: "250 ml",
                    serving_quantity: 250,
                    no_nutrition_data: "on",
                    nutriments: { "energy-kcal_serving": 160 },
                },
            }),
        );

        await expect(hydrateProduct(hit)).resolves.toEqual({
            code: "1",
            product_name: "Whole milk",
            product_name_de: "Vollmilch",
            brands: "Weihenstephan",
            quantity: "1 l",
            serving_size: "250 ml",
            serving_quantity: 250,
            no_nutrition_data: "on",
            nutriments: { "energy-kcal_serving": 160 },
            complete: true,
        });
        expect(lastUrl()).toContain("world.openfoodfacts.org/api/v2/product/1");
        expect(lastUrl()).toContain("no_nutrition_data");
        // The localized names have to be asked for explicitly (#401).
        expect(lastUrl()).toContain("product_name_de");
    });

    // OFF answers with `""` for text fields it has no value for, which used to
    // be enough to wipe a localized name or the pack size off the search hit.
    it("does not let the API's blanks overwrite the search hit", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({
                status: 1,
                code: "1",
                product: {
                    code: "1",
                    product_name: "",
                    product_name_de: "",
                    brands: "",
                    quantity: "",
                    serving_size: "250 ml",
                },
            }),
        );

        await expect(hydrateProduct(hit)).resolves.toEqual({
            ...hit,
            serving_size: "250 ml",
            complete: true,
        });
    });

    it("skips the request for a product that already came from the product API", async () => {
        const complete = { ...hit, complete: true };

        await expect(hydrateProduct(complete)).resolves.toBe(complete);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns the search hit unchanged when the lookup fails", async () => {
        fetchMock.mockRejectedValue(new Error("Network request failed"));
        await expect(hydrateProduct(hit)).resolves.toEqual(hit);

        fetchMock.mockResolvedValue(jsonResponse({}, 503));
        await expect(hydrateProduct(hit)).resolves.toEqual(hit);

        fetchMock.mockResolvedValue(jsonResponse({ status: 0, code: "1" }));
        await expect(hydrateProduct(hit)).resolves.toEqual(hit);
    });
});
