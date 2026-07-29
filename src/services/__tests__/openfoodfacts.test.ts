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

import { hydrateServing, searchProducts } from "@/src/services/openfoodfacts";

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
        expect(url.searchParams.get("fields")).toContain("nutriments");
    });

    it("maps hits to products, preferring the localized name", async () => {
        fetchMock.mockResolvedValue(
            searchHits([
                {
                    code: "1",
                    product_name: "Whole milk",
                    product_name_de: "Vollmilch",
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
                product_name: "Vollmilch",
                quantity: "1 l",
                nutriments: { "energy-kcal_100g": 64, proteins_100g: 3.4 },
            },
            { code: "2", product_name: "Skyr", quantity: undefined, nutriments: undefined },
        ]);
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

describe("hydrateServing", () => {
    const product = { code: "1", product_name: "Vollmilch", quantity: "1 l" };

    it("merges the serving fields the search index does not carry", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({
                status: 1,
                code: "1",
                product: { code: "1", serving_size: "250 ml", serving_quantity: 250 },
            }),
        );

        await expect(hydrateServing(product)).resolves.toEqual({
            ...product,
            serving_size: "250 ml",
            serving_quantity: 250,
        });
        expect(lastUrl()).toContain("world.openfoodfacts.org/api/v2/product/1");
    });

    it("skips the request when the product already has serving data", async () => {
        const withServing = { ...product, serving_quantity: 250 };

        await expect(hydrateServing(withServing)).resolves.toBe(withServing);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns the product unchanged when the lookup fails", async () => {
        fetchMock.mockRejectedValue(new Error("Network request failed"));
        await expect(hydrateServing(product)).resolves.toEqual(product);

        fetchMock.mockResolvedValue(jsonResponse({}, 503));
        await expect(hydrateServing(product)).resolves.toEqual(product);

        fetchMock.mockResolvedValue(jsonResponse({ status: 0, code: "1" }));
        await expect(hydrateServing(product)).resolves.toEqual(product);
    });
});
