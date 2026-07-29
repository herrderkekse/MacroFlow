import i18n from "@/src/i18n";
import type { foods } from "@/src/services/db/schema";
import {
    productNutrition,
    type NutritionSource,
    type OFFNutriments,
} from "@/src/services/offNutriments";
import logger from "@/src/utils/logger";
import type { FoodUnit } from "@/src/utils/units";

export { productNutrition } from "@/src/services/offNutriments";
export type { OFFNutriments, ProductNutrition } from "@/src/services/offNutriments";

const BASE_URL = "https://world.openfoodfacts.org";
// Full-text search runs on Search-a-licious. The legacy `cgi/search.pl` (and
// `/api/v2/search`) endpoint is rejected at OFF's edge with a 503 roughly half
// the time, so search there failed for no reason a user could act on.
const SEARCH_URL = "https://search.openfoodfacts.org/search";
const USER_AGENT = "MacroFlow/1.0 (React Native; open-source nutrient tracker)";

// Client-side rate limiter for search: OpenFoodFacts allows 10 req/min/IP.
// Track request timestamps in a sliding 60 s window so users can burst a few
// requests quickly (or space them out) as long as the window stays under the cap.
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX_PER_WINDOW = 10;
const searchTimestamps: number[] = [];

const SEARCH_PAGE_SIZE = 20;
/** One retry is enough for the transient 5xx/network blips we see in practice. */
const SEARCH_RETRIES = 1;
const RETRY_DELAY_MS = 300;

export interface OFFProduct extends NutritionSource {
    code: string;
    product_name?: string;
    serving_size?: string;
    quantity?: string;
    /** `true` from the search index, `"on"` / `""` from the product API. */
    obsolete?: boolean | string;
    /**
     * True once every field in `FIELDS` has been fetched. A search hit carries
     * only `SEARCH_FIELDS`, so it needs `hydrateProduct` before it can be judged.
     */
    complete?: boolean;
}

interface OFFProductResponse {
    status: number;
    code: string;
    product?: OFFProduct;
}

/**
 * A Search-a-licious result. Localized names come back as `product_name_de`,
 * `product_name_en`, … — one key per language in `langs`, hence the index
 * signature.
 */
interface OFFSearchHit {
    code?: string;
    product_name?: string;
    nutriments?: OFFNutriments;
    quantity?: string;
    /** Only present, and only ever `true`, for delisted products. */
    obsolete?: boolean;
    [localizedField: string]: unknown;
}

interface OFFSearchResponse {
    hits?: OFFSearchHit[];
    page?: number;
    page_count?: number;
}

const FIELDS =
    "code,product_name,nutriments,serving_size,serving_quantity,quantity,no_nutrition_data,obsolete";

// The Search-a-licious index carries neither the serving fields
// (`serving_size`, `serving_quantity`) nor `no_nutrition_data`, and its
// `nutriments` hold only the as-sold per-100 g figures. `hydrateProduct` fetches
// the rest per selection. `obsolete` *is* indexed, and only appears when true.
const SEARCH_FIELDS = ["code", "product_name", "nutriments", "quantity", "obsolete"];

/**
 * The `foods` columns an OFF product determines. Every column the DB would
 * default is filled in, so the result is also enough to stand in for a food
 * row that has not been written yet (see `useIngredientSearch`).
 */
export type FoodFromProduct = Omit<
    Required<typeof foods.$inferInsert>,
    "id" | "last_logged_amount" | "last_logged_unit" | "last_logged_meal" | "deleted" | "uuid"
>;

/** Guess the default unit from OFF serving_size or quantity string. */
function guessUnit(product: OFFProduct): FoodUnit {
    const text = (product.serving_size ?? product.quantity ?? "").toLowerCase();
    if (/\bml\b/.test(text) || /\bcl\b/.test(text) || /\bliter|\blitre/.test(text))
        return "ml";
    if (/\bfl\s?oz\b/.test(text)) return "fl_oz";
    if (/\bcup/.test(text)) return "cup";
    if (/\btbsp\b/.test(text)) return "tbsp";
    if (/\btsp\b/.test(text)) return "tsp";
    if (/\boz\b/.test(text)) return "oz";
    if (/\blb\b/.test(text)) return "lb";
    return "g";
}

/** Parse a numeric serving size from OFF, e.g. "250 ml" → 250. */
function parseServingSize(product: OFFProduct): number {
    if (product.serving_quantity && product.serving_quantity > 0)
        return product.serving_quantity;
    const m = (product.serving_size ?? "").match(/([\d.]+)/);
    return m ? parseFloat(m[1]) || 100 : 100;
}

/** OFF answers `status: 1` for delisted products too, so callers must ask. */
export function isObsolete(product: OFFProduct): boolean {
    return product.obsolete === true || product.obsolete === "on";
}

/**
 * A product either maps to a food or explains why it cannot. The failure
 * carries what we *do* know so the caller can send the user to manual entry
 * with the name and barcode already filled in, rather than into a dead end.
 */
export type ProductImport =
    | { ok: true; food: FoodFromProduct; prepared: boolean }
    | { ok: false; reason: "no-nutrition-data"; name: string; barcode: string };

/**
 * The one OFF product → food mapping. Every entry path (text search, barcode
 * scan, recipe ingredient search) goes through here so a product yields the
 * same food however the user found it.
 *
 * `barcode` and `openfoodfacts_id` both get `product.code`: OFF keys products
 * by their EAN, so for an OFF-sourced food the two are the same value, and
 * leaving `barcode` empty would hide the food from `getFoodByBarcode`.
 *
 * Serving fields and the validation flags are only as good as the product
 * handed in — a Search-a-licious hit carries neither, so run it through
 * `hydrateProduct` before importing.
 */
export function productToFood(
    product: OFFProduct,
    opts: { fallbackName: string },
): ProductImport {
    const name = product.product_name || opts.fallbackName;
    const nutrition = productNutrition(product);
    if (!nutrition) {
        return { ok: false, reason: "no-nutrition-data", name, barcode: product.code };
    }

    const { prepared, ...macros } = nutrition;
    return {
        ok: true,
        prepared,
        food: {
            name,
            ...macros,
            barcode: product.code,
            openfoodfacts_id: product.code,
            source: "openfoodfacts",
            default_unit: guessUnit(product),
            serving_size: parseServingSize(product),
        },
    };
}

export async function getProductByBarcode(
    barcode: string,
): Promise<OFFProduct | null> {
    logger.info("[API] Fetching product by barcode", { barcode });

    const res = await fetch(
        `${BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`,
        { headers: { "User-Agent": USER_AGENT } },
    );

    if (!res.ok) {
        logger.error("[API] Barcode lookup failed", { status: res.status });
        return null;
    }

    const data: OFFProductResponse = await res.json();
    if (data.status !== 1 || !data.product?.product_name) return null;
    return { ...data.product, complete: true };
}

/**
 * Claim one of the requests the sliding window allows, or throw with the wait
 * time. A search that ends in an error must `release()` its slot again:
 * charging for a response that carried no products means a flaky upstream also
 * rate-limits the user.
 */
function reserveSearchSlot(): { release: () => void } {
    const now = Date.now();
    // Drop timestamps that have aged out of the sliding window.
    while (searchTimestamps.length && now - searchTimestamps[0] >= SEARCH_WINDOW_MS) {
        searchTimestamps.shift();
    }
    if (searchTimestamps.length >= SEARCH_MAX_PER_WINDOW) {
        const waitSec = Math.ceil(
            (SEARCH_WINDOW_MS - (now - searchTimestamps[0])) / 1000,
        );
        throw new Error(i18n.t("common.rateLimitedWait", { seconds: waitSec }));
    }
    searchTimestamps.push(now);
    return {
        release: () => {
            const i = searchTimestamps.indexOf(now);
            if (i !== -1) searchTimestamps.splice(i, 1);
        },
    };
}

/**
 * Languages to match product names in, app language first. English is kept as
 * a fallback because many products are only named in English, and dropping it
 * loses results.
 */
function searchLangs(): string[] {
    const lang = (i18n.language ?? "en").split("-")[0] || "en";
    return lang === "en" ? ["en"] : [lang, "en"];
}

/** Retry a search once on a server-side failure; 4xx is our bug, not a blip. */
async function fetchSearchWithRetry(url: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        try {
            const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
            if (res.ok || res.status < 500 || attempt === SEARCH_RETRIES) return res;
            logger.warn("[API] Search returned a server error, retrying", {
                status: res.status,
                attempt,
            });
        } catch (err) {
            if (attempt === SEARCH_RETRIES) throw err;
            logger.warn("[API] Search request errored, retrying", {
                attempt,
                error: String(err),
            });
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
}

function productFromHit(hit: OFFSearchHit, langs: string[]): OFFProduct {
    const localizedName = langs
        .map((lang) => hit[`product_name_${lang}`])
        .find((name): name is string => typeof name === "string" && name.length > 0);
    return {
        code: String(hit.code),
        product_name: localizedName ?? hit.product_name,
        nutriments: hit.nutriments,
        quantity: hit.quantity,
        obsolete: hit.obsolete === true,
    };
}

export async function searchProducts(
    query: string,
    page = 1,
): Promise<OFFProduct[]> {
    const slot = reserveSearchSlot();
    let succeeded = false;

    try {
        logger.info("[API] Searching products", { query, page });

        const langs = searchLangs();
        const params = new URLSearchParams({
            q: query,
            langs: langs.join(","),
            page: String(page),
            page_size: String(SEARCH_PAGE_SIZE),
            fields: [
                ...SEARCH_FIELDS,
                ...langs.map((lang) => `product_name_${lang}`),
            ].join(","),
        });

        const res = await fetchSearchWithRetry(`${SEARCH_URL}?${params}`);

        if (!res.ok) {
            logger.error("[API] Search failed", { status: res.status });
            throw new Error(
                res.status >= 500
                    ? i18n.t("common.openFoodFactsUnavailable")
                    : i18n.t("common.searchFailedHttp", { status: res.status }),
            );
        }

        const data: OFFSearchResponse = await res.json();
        const products = (data.hits ?? [])
            .filter((hit) => hit.code)
            .map((hit) => productFromHit(hit, langs))
            .filter((product) => product.product_name);

        succeeded = true;
        return products;
    } finally {
        if (!succeeded) slot.release();
    }
}

/**
 * Fill in everything a search result cannot carry — the serving fields, the
 * prepared/per-serving nutriments and `no_nutrition_data` — from the product
 * API. Best-effort and never throws: on failure the thinner search hit stands,
 * which is not worth failing a selection over.
 */
export async function hydrateProduct(product: OFFProduct): Promise<OFFProduct> {
    if (product.complete) return product;

    logger.info("[API] Hydrating product", { code: product.code });
    try {
        const res = await fetch(
            `${BASE_URL}/api/v2/product/${encodeURIComponent(product.code)}?fields=${FIELDS}`,
            { headers: { "User-Agent": USER_AGENT } },
        );
        if (!res.ok) {
            logger.warn("[API] Product hydration failed", { status: res.status });
            return product;
        }
        const data: OFFProductResponse = await res.json();
        if (data.status !== 1 || !data.product) return product;
        return {
            ...data.product,
            // The search index is the only source of a localized product name;
            // its nutriments and pack size still beat nothing where the product
            // API returned neither.
            product_name: product.product_name || data.product.product_name,
            nutriments: data.product.nutriments ?? product.nutriments,
            quantity: data.product.quantity || product.quantity,
            complete: true,
        };
    } catch (err) {
        logger.warn("[API] Product hydration errored", { error: String(err) });
        return product;
    }
}
