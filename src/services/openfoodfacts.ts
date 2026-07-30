import i18n from "@/src/i18n";
import type { foods } from "@/src/services/db/schema";
import {
    productNutrition,
    type NutritionSource,
    type OFFNutriments,
} from "@/src/services/offNutriments";
import { createRateLimiter } from "@/src/services/rateLimit";
import logger from "@/src/utils/logger";
import type { FoodUnit } from "@/src/utils/units";
import Constants from "expo-constants";

export { productNutrition } from "@/src/services/offNutriments";
export type { OFFNutriments, ProductNutrition } from "@/src/services/offNutriments";

const BASE_URL = "https://world.openfoodfacts.org";
// Full-text search runs on Search-a-licious. The legacy `cgi/search.pl` (and
// `/api/v2/search`) endpoint is rejected at OFF's edge with a 503 roughly half
// the time, so search there failed for no reason a user could act on.
const SEARCH_URL = "https://search.openfoodfacts.org/search";

/** Where OFF can reach us about our traffic, as their User-Agent format asks. */
const CONTACT_EMAIL = "info.macroflow@gmail.com";
/**
 * OFF asks every client to identify itself as `AppName/Version (ContactEmail)`
 * and treats an anonymous one as grounds for blocking. The version comes from
 * `app.json` rather than being written out here, where it went stale within a
 * release of being added.
 */
const USER_AGENT = `MacroFlow/${Constants.expoConfig?.version ?? "0.0.0"} (${CONTACT_EMAIL})`;

// One budget per class of endpoint OFF publishes a limit for: 10 req/min/IP for
// search, 15 for product reads.
const searchLimiter = createRateLimiter(10);
const productLimiter = createRateLimiter(15);

const SEARCH_PAGE_SIZE = 20;
/** One retry is enough for the transient 5xx/network blips we see in practice. */
const SEARCH_RETRIES = 1;
const RETRY_DELAY_MS = 300;

export interface OFFProduct extends NutritionSource {
    code: string;
    /**
     * OFF's name in the *product's* own language, whatever that is — a German
     * user searching "pesto" gets `PESTO alla GENOVESE`. `productName` resolves
     * the localized keys below first; nothing should read this one directly.
     */
    product_name?: string;
    /** `product_name_de`, `product_name_en`, … — one key per requested language. */
    [localizedName: `product_name_${string}`]: string | undefined;
    /**
     * Owning brand first. The product API sends one comma-separated string
     * (`"Barilla,Barilla Pesto"`), the search index the same list as an array —
     * `primaryBrand` reads either.
     */
    brands?: string | string[];
    serving_size?: string;
    /**
     * OFF's own normalization of `serving_quantity`: the number is already
     * converted and this is the plain unit it was converted to, only ever
     * `"g"` or `"ml"`. Preferred over reading `serving_size` free text.
     */
    serving_quantity_unit?: string;
    /** Net contents of the whole package, normalized the same way. */
    product_quantity?: number | string;
    product_quantity_unit?: string;
    quantity?: string;
    /** `true` from the search index, `"on"` / `""` from the product API. */
    obsolete?: boolean | string;
    /**
     * True once every field in `FIELDS` has been fetched. A search hit carries
     * only `SEARCH_FIELDS`, so it needs `hydrateProduct` before it can be judged.
     */
    complete?: boolean;
}

/**
 * The v3 product envelope. v3 reports the outcome twice — `status` as
 * `"success"`/`"failure"` and `result.id` as `"product_found"` /
 * `"product_not_found"` — where v2 sent a numeric `status`, and it answers a
 * barcode it does not know with a 404 rather than a 200. `result.id` is the
 * narrower of the two checks, so it is the one worth making.
 */
interface OFFProductResponse {
    status?: string;
    result?: { id?: string };
    code?: string;
    product?: OFFProduct;
}

const PRODUCT_FOUND = "product_found";

/**
 * A Search-a-licious result. Localized names come back as `product_name_de`,
 * `product_name_en`, … — one key per language in `langs`, hence the index
 * signature.
 */
interface OFFSearchHit {
    code?: string;
    product_name?: string;
    /** Already split into a list here, unlike the product API's one string. */
    brands?: string[];
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

const FIELDS = [
    "code",
    "product_name",
    "brands",
    "nutriments",
    "serving_size",
    "serving_quantity",
    "serving_quantity_unit",
    "product_quantity",
    "product_quantity_unit",
    "quantity",
    "no_nutrition_data",
    "obsolete",
];

// The Search-a-licious index carries neither the serving/package fields
// (`serving_size`, `serving_quantity`, `product_quantity`, …) nor `no_nutrition_data`, and its
// `nutriments` hold only the as-sold per-100 g figures. `hydrateProduct` fetches
// the rest per selection. `obsolete` *is* indexed, and only appears when true.
const SEARCH_FIELDS = ["code", "product_name", "brands", "nutriments", "quantity", "obsolete"];

/**
 * The `fields` parameter both endpoints take. The localized names have to be
 * asked for by name: neither `?lc=de`, `?cc=de` nor `de.openfoodfacts.org`
 * makes v2 localize `product_name` for you (#401).
 */
function fieldsParam(fields: string[]): string {
    return [...fields, ...nameLangs().map((lang) => `product_name_${lang}`)].join(",");
}

/**
 * The `foods` columns an OFF product determines. Every column the DB would
 * default is filled in, so the result is also enough to stand in for a food
 * row that has not been written yet (see `useIngredientSearch`).
 */
export type FoodFromProduct = Omit<
    Required<typeof foods.$inferInsert>,
    "id" | "last_logged_amount" | "last_logged_unit" | "last_logged_meal" | "deleted" | "uuid"
>;

/** The serving size assumed for a product that states none. */
const DEFAULT_SERVING_SIZE = 100;

/** OFF sends its quantity fields as numbers on some products and strings on others. */
function numeric(value: number | string | undefined): number | undefined {
    const n = typeof value === "string" ? parseFloat(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/**
 * The two units OFF normalizes its quantities to, and the only ones we can
 * store: `serving_units.grams` is grams, so `ml` rides on the app-wide ≈1 g/ml
 * assumption in `src/utils/units.ts`. Anything else is left to the caller.
 */
function storableUnit(unit: string | undefined): FoodUnit | undefined {
    const u = unit?.trim().toLowerCase();
    return u === "g" || u === "ml" ? u : undefined;
}

/**
 * The unit a food's amounts are entered in. OFF's `*_quantity_unit` fields are
 * already normalized to `"g"` or `"ml"`, so they beat reading the free text:
 * plenty of products (Nutella, 3017620422003) carry the unit and no
 * `serving_size` string at all, and the numbers we pair the unit with —
 * `serving_quantity`, `product_quantity` — are normalized to match it.
 */
function guessUnit(product: OFFProduct): FoodUnit {
    return (
        storableUnit(product.serving_quantity_unit)
        ?? storableUnit(product.product_quantity_unit)
        ?? unitFromText(product)
    );
}

/**
 * Every spelling of a unit OFF's free text uses, most specific first: the
 * alternations are ordered so `liter` is tried before the bare `l` it starts
 * with, and `fl oz` before `oz`.
 *
 * `(?:^|[^a-z])` stands in for a leading `\b`, which would demand a separator
 * between the number and the unit and so miss `330ml` (#407). A *letter* in
 * front is still what disqualifies a match, so `fl` is not a liter and `caramel`
 * is not a millilitre.
 */
const TEXT_UNITS: [RegExp, FoodUnit][] = [
    [/(?:^|[^a-z])(?:liters?|litres?|ml|cl|l)\b/, "ml"],
    [/(?:^|[^a-z])fl\s?oz\b/, "fl_oz"],
    [/(?:^|[^a-z])cup/, "cup"],
    [/(?:^|[^a-z])tbsp\b/, "tbsp"],
    [/(?:^|[^a-z])tsp\b/, "tsp"],
    [/(?:^|[^a-z])oz\b/, "oz"],
    [/(?:^|[^a-z])lb\b/, "lb"],
];

/**
 * Fallback for products carrying no normalized unit at all. Note that `cl` maps
 * to `ml` without touching the number: safe only because the number beside it
 * comes from OFF pre-converted ("33 cl" → `serving_quantity: 330`).
 */
function unitFromText(product: OFFProduct): FoodUnit {
    const text = (product.serving_size ?? product.quantity ?? "").toLowerCase();
    return TEXT_UNITS.find(([pattern]) => pattern.test(text))?.[1] ?? "g";
}

/**
 * The serving size in `default_unit`, e.g. "250 ml" → 250, or undefined when
 * OFF states none. Undefined rather than `DEFAULT_SERVING_SIZE` so that a
 * guess stays distinguishable from a product whose serving really is 100 g.
 */
function parseServingSize(product: OFFProduct): number | undefined {
    const quantity = numeric(product.serving_quantity);
    if (quantity !== undefined && quantity > 0) return quantity;
    const parsed = numeric((product.serving_size ?? "").match(/([\d.]+)/)?.[1]);
    return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

/** One `serving_units` row a product implies, before the food row exists. */
export interface DerivedServingUnit {
    name: string;
    grams: number;
}

/** A normalized OFF quantity as grams, or undefined if there is none to store. */
function quantityGrams(
    value: number | string | undefined,
    unit: string | undefined,
): number | undefined {
    const amount = numeric(value);
    if (amount === undefined || amount <= 0) return undefined;
    // A missing unit is normal on older products, and harmless: OFF only ever
    // normalizes to g or ml, which are the same number of grams either way.
    // A unit we cannot convert is what disqualifies the quantity.
    if (unit && !storableUnit(unit)) return undefined;
    return amount;
}

/**
 * The serving units OFF's two quantities imply: one serving, and the whole
 * package. Scan a jar of pesto and both "1 serving" and "1 package (190 g)" are
 * there, rather than the user hand-building a fact OFF already published.
 *
 * A package that weighs exactly one serving (a 330 ml can of Coke) yields no
 * second row — the same amount under two names is only clutter in the picker.
 *
 * The names are resolved at import time and then frozen in the DB, like
 * `productName`: entries reference a serving unit by name, so re-translating
 * one later would orphan them.
 */
function servingUnitsFromProduct(product: OFFProduct): DerivedServingUnit[] {
    const units: DerivedServingUnit[] = [];
    const serving = quantityGrams(product.serving_quantity, product.serving_quantity_unit);
    if (serving !== undefined) {
        units.push({ name: i18n.t("common.offServingUnitServing"), grams: serving });
    }
    const pack = quantityGrams(product.product_quantity, product.product_quantity_unit);
    if (pack !== undefined && pack !== serving) {
        units.push({ name: i18n.t("common.offServingUnitPackage"), grams: pack });
    }
    return units;
}

/**
 * Languages to read product names in, app language first. English is kept as a
 * fallback because many products are only named in English, and dropping it
 * loses both results and names.
 */
function nameLangs(): string[] {
    const lang = (i18n.language ?? "en").split("-")[0] || "en";
    return lang === "en" ? ["en"] : [lang, "en"];
}

/** The best name OFF has for the product, or undefined if it has none. */
function localizedName(product: OFFProduct): string | undefined {
    for (const lang of nameLangs()) {
        const name = product[`product_name_${lang}`]?.trim();
        if (name) return name;
    }
    return product.product_name?.trim() || undefined;
}

/**
 * The owning brand, which OFF lists first. Everything after it is unreliable:
 * the product API hands `brands` over as one comma-separated string, and OFF's
 * data has whole postal addresses in that field, so the tail is often the rest
 * of an address split on its own commas. The search index sends the same field
 * pre-split into an array — with the same junk in it.
 */
function primaryBrand(product: OFFProduct): string | undefined {
    const brands = product.brands;
    const first = Array.isArray(brands) ? brands[0] : brands?.split(",")[0];
    return typeof first === "string" ? first.trim() || undefined : undefined;
}

/**
 * How a product is named everywhere in the app — in the search list and in the
 * food it is imported as, so the row a user picks is the row they get.
 *
 * The brand is prefixed because a bare "Pesto alla Genovese" says little next
 * to five near-identical hits, and it goes into `foods.name` rather than only
 * the search list so that searching the library for "Barilla" finds it. Names
 * that already carry the brand ("Nutella", brand `Nutella,Ferrero`) are left
 * alone.
 */
export function productName(product: OFFProduct, fallback: string): string {
    const name = localizedName(product);
    const brand = primaryBrand(product);
    if (!name) return brand ?? fallback;
    if (!brand || name.toLowerCase().includes(brand.toLowerCase())) return name;
    return `${brand} ${name}`;
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
    | {
        ok: true;
        food: FoodFromProduct;
        prepared: boolean;
        /** To write once the food row exists — they need its id. */
        servingUnits: DerivedServingUnit[];
        /**
         * True when OFF states no serving size and `food.serving_size` is our
         * `DEFAULT_SERVING_SIZE` rather than the product's own figure.
         */
        servingSizeGuessed: boolean;
    }
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
 * The derived serving units come back beside the food rather than in it: they
 * are rows of their own and need the food's id, so the caller writes them once
 * it has one (`addFoodWithServingUnits`, or `materializeFood` for a recipe
 * ingredient that is not saved yet).
 *
 * Serving fields and the validation flags are only as good as the product
 * handed in — a Search-a-licious hit carries neither, so run it through
 * `hydrateProduct` before importing.
 *
 * The name is resolved (`productName`) at import time and then frozen in the
 * DB, so switching the app language later leaves existing foods named as they
 * were imported.
 */
export function productToFood(
    product: OFFProduct,
    opts: { fallbackName: string },
): ProductImport {
    const name = productName(product, opts.fallbackName);
    const nutrition = productNutrition(product);
    if (!nutrition) {
        return { ok: false, reason: "no-nutrition-data", name, barcode: product.code };
    }

    const { prepared, ...macros } = nutrition;
    const servingSize = parseServingSize(product);
    if (servingSize === undefined) {
        logger.info("[API] OFF product states no serving size, assuming the default", {
            code: product.code,
            assumed: DEFAULT_SERVING_SIZE,
        });
    }

    return {
        ok: true,
        prepared,
        servingUnits: servingUnitsFromProduct(product),
        servingSizeGuessed: servingSize === undefined,
        food: {
            name,
            ...macros,
            barcode: product.code,
            openfoodfacts_id: product.code,
            source: "openfoodfacts",
            default_unit: guessUnit(product),
            serving_size: servingSize ?? DEFAULT_SERVING_SIZE,
        },
    };
}

function productUrl(code: string): string {
    return `${BASE_URL}/api/v3/product/${encodeURIComponent(code)}?fields=${fieldsParam(FIELDS)}`;
}

/**
 * One product read, against the budget OFF allows for them. The slot is spent
 * whatever the answer turns out to be — unlike a search, a lookup that comes
 * back empty is still a request OFF served and counted.
 *
 * @throws {RateLimitError} when the window is full.
 */
function fetchProduct(code: string): Promise<Response> {
    productLimiter.reserve();
    return fetch(productUrl(code), { headers: { "User-Agent": USER_AGENT } });
}

/**
 * The product behind a scanned barcode, or null if OFF has none worth
 * importing.
 *
 * @throws {RateLimitError} when too many barcodes were scanned in a minute —
 * the one failure the caller can do something about, so it is not folded into
 * the null.
 */
export async function getProductByBarcode(
    barcode: string,
): Promise<OFFProduct | null> {
    logger.info("[API] Fetching product by barcode", { barcode });

    const res = await fetchProduct(barcode);

    // A barcode OFF has never seen is a 404 on v3, and not an error worth logging as one.
    if (res.status === 404) {
        logger.info("[API] OFF does not know this barcode", { barcode });
        return null;
    }
    if (!res.ok) {
        logger.error("[API] Barcode lookup failed", { status: res.status });
        return null;
    }

    const data: OFFProductResponse = await res.json();
    if (data.result?.id !== PRODUCT_FOUND || !data.product || !localizedName(data.product)) {
        return null;
    }
    return { ...data.product, complete: true };
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

/**
 * The localized names the index returned, kept as the `product_name_<lang>`
 * keys they came as: picking one is `productName`'s job, and doing it here
 * would let the search list and the import disagree.
 */
function localizedNames(hit: OFFSearchHit, langs: string[]): Partial<OFFProduct> {
    const names: Partial<OFFProduct> = {};
    for (const lang of langs) {
        const name = hit[`product_name_${lang}`];
        if (typeof name === "string" && name.length > 0) {
            names[`product_name_${lang}`] = name;
        }
    }
    return names;
}

function productFromHit(hit: OFFSearchHit, langs: string[]): OFFProduct {
    return {
        code: String(hit.code),
        product_name: hit.product_name,
        ...localizedNames(hit, langs),
        brands: hit.brands,
        nutriments: hit.nutriments,
        quantity: hit.quantity,
        obsolete: hit.obsolete === true,
    };
}

export async function searchProducts(
    query: string,
    page = 1,
): Promise<OFFProduct[]> {
    // A search that ends in an error releases its slot again: charging for a
    // response that carried no products means a flaky upstream also rate-limits
    // the user.
    const slot = searchLimiter.reserve();
    let succeeded = false;

    try {
        logger.info("[API] Searching products", { query, page });

        const langs = nameLangs();
        const params = new URLSearchParams({
            q: query,
            langs: langs.join(","),
            page: String(page),
            page_size: String(SEARCH_PAGE_SIZE),
            fields: fieldsParam(SEARCH_FIELDS),
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
            .filter((product) => localizedName(product));

        succeeded = true;
        return products;
    } finally {
        if (!succeeded) slot.release();
    }
}

/**
 * The product API's answer laid over the search hit. OFF returns `""` for text
 * fields it has no value for, so a blank from the API must not erase what the
 * index did carry — that is how a localized name or a pack size gets lost.
 */
function mergeProduct(hit: OFFProduct, fetched: OFFProduct): OFFProduct {
    const filled = Object.fromEntries(
        Object.entries(fetched).filter(
            ([, value]) => value !== undefined && value !== null && value !== "",
        ),
    );
    return { ...hit, ...filled };
}

/**
 * Fill in everything a search result cannot carry — the serving fields, the
 * prepared/per-serving nutriments and `no_nutrition_data` — from the product
 * API. Best-effort and never throws: on failure the thinner search hit stands,
 * which is not worth failing a selection over. Being rate-limited is one such
 * failure — a hydration is a product read like any other, and a user who has
 * spent the budget elsewhere gets the hit rather than an error.
 */
export async function hydrateProduct(product: OFFProduct): Promise<OFFProduct> {
    if (product.complete) return product;

    logger.info("[API] Hydrating product", { code: product.code });
    try {
        const res = await fetchProduct(product.code);
        if (!res.ok) {
            logger.warn("[API] Product hydration failed", { status: res.status });
            return product;
        }
        const data: OFFProductResponse = await res.json();
        if (data.result?.id !== PRODUCT_FOUND || !data.product) return product;
        return { ...mergeProduct(product, data.product), complete: true };
    } catch (err) {
        logger.warn("[API] Product hydration errored", { error: String(err) });
        return product;
    }
}
