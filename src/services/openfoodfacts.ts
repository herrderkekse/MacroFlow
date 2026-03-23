import logger from "@/src/utils/logger";

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
}

interface OFFProductResponse {
    status: number;
    code: string;
    product?: OFFProduct;
}

interface OFFSearchResponse {
    products?: OFFProduct[];
}

export async function getProductByBarcode(
    barcode: string,
): Promise<OFFProduct | null> {
    logger.info("[API] Fetching product by barcode", { barcode });

    const res = await fetch(
        `${BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}?fields=code,product_name,nutriments`,
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
        fields: "code,product_name,nutriments",
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
