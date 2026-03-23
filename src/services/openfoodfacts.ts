import logger from "@/src/utils/logger";
import type { FoodUnit } from "@/src/utils/units";

const BASE_URL = "https://world.openfoodfacts.org";
const USER_AGENT = "MacroFlow/1.0 (React Native; open-source nutrient tracker)";

// Client-side rate limiter for search (10 req/min ≈ 1 per 6 s)
const SEARCH_MIN_INTERVAL_MS = 6_000;
let lastSearchTimestamp = 0;

export interface OFFProduct {
    code: string;
    product_name?: string;
    nutriments?: {
        "energy-kcal_100g"?: number;
        proteins_100g?: number;
        carbohydrates_100g?: number;
        fat_100g?: number;
    };
    serving_size?: string;
    serving_quantity?: number;
    quantity?: string;
}

interface OFFProductResponse {
    status: number;
    code: string;
    product?: OFFProduct;
}

interface OFFSearchResponse {
    products?: OFFProduct[];
}

const FIELDS =
    "code,product_name,nutriments,serving_size,serving_quantity,quantity";

/** Guess the default unit from OFF serving_size or quantity string. */
export function guessUnit(product: OFFProduct): FoodUnit {
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
export function parseServingSize(product: OFFProduct): number {
    if (product.serving_quantity && product.serving_quantity > 0)
        return product.serving_quantity;
    const m = (product.serving_size ?? "").match(/([\d.]+)/);
    return m ? parseFloat(m[1]) || 100 : 100;
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
    return data.product;
}

export async function searchProducts(
    query: string,
    page = 1,
): Promise<OFFProduct[]> {
    const now = Date.now();
    const elapsed = now - lastSearchTimestamp;
    if (elapsed < SEARCH_MIN_INTERVAL_MS) {
        const waitSec = Math.ceil(
            (SEARCH_MIN_INTERVAL_MS - elapsed) / 1000,
        );
        throw new Error(`Rate limited — please wait ${waitSec}s`);
    }
    lastSearchTimestamp = now;

    logger.info("[API] Searching products", { query, page });

    const params = new URLSearchParams({
        search_terms: query,
        json: "1",
        page: String(page),
        page_size: "20",
        fields: FIELDS,
    });

    const res = await fetch(`${BASE_URL}/cgi/search.pl?${params}`, {
        headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
        logger.error("[API] Search failed", { status: res.status });
        throw new Error("Search request failed");
    }

    const data: OFFSearchResponse = await res.json();
    return (data.products ?? []).filter((p) => p.product_name);
}
