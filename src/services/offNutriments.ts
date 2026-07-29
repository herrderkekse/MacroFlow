/**
 * Turning an OpenFoodFacts nutriment payload into the per-100 g figures a food
 * row needs. Split out of `openfoodfacts.ts` because deciding *which* of a
 * product's figures to trust is the fiddly half of the import, and it is pure:
 * no fetching, no i18n, no logging.
 */

/**
 * OFF publishes one key per nutrient × preparation × scope — `proteins_100g`,
 * `energy-kcal_serving`, `carbohydrates_prepared_100g`, … — so the keys we read
 * are composed rather than declared. The four named ones are the common case
 * and stay spelled out for the call sites that only want those.
 */
export interface OFFNutriments {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    [nutrimentKey: string]: number | undefined;
}

/** The part of an OFF product that decides its nutrition figures. */
export interface NutritionSource {
    nutriments?: OFFNutriments;
    /** The serving mass in g or ml, needed to normalize per-serving figures. */
    serving_quantity?: number;
    /** `"on"` when the contributor stated the pack carries no nutrition facts. */
    no_nutrition_data?: string;
}

export interface ProductNutrition {
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
    /** True when the numbers describe the product as prepared, not as sold. */
    prepared: boolean;
}

/** Energy conversion, for the many products that carry only the kJ figure. */
const KJ_PER_KCAL = 4.184;

/** The OFF nutriment key stem behind each macro column. */
const MACRO_STEMS = {
    protein_per_100g: "proteins",
    carbs_per_100g: "carbohydrates",
    fat_per_100g: "fat",
} as const;

/** As sold vs. as prepared — OFF suffixes the prepared keys. */
type Preparation = "" | "_prepared";
/** Which quantity the figures describe. */
type Scope = "100g" | "serving";

/** Trim the float noise OFF's own unit conversions leave behind. */
function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/** Read one composed nutriment key, e.g. `proteins_prepared_serving`. */
function nutriment(
    nutriments: OFFNutriments,
    stem: string,
    preparation: Preparation,
    scope: Scope,
): number | undefined {
    const value = nutriments[`${stem}${preparation}_${scope}`];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Energy in kcal. Plenty of products (mostly EU ones) publish only
 * `energy-kj_*`, which used to read as 0 kcal even though the macros were all
 * there. The bare `energy_*` key is deliberately not used: its unit varies.
 */
function energyKcal(
    nutriments: OFFNutriments,
    preparation: Preparation,
    scope: Scope,
): number | undefined {
    const kcal = nutriment(nutriments, "energy-kcal", preparation, scope);
    if (kcal !== undefined) return kcal;
    const kj = nutriment(nutriments, "energy-kj", preparation, scope);
    return kj !== undefined ? kj / KJ_PER_KCAL : undefined;
}

/** The figures for one preparation/scope combination, or null if it has none. */
function readNutrition(
    product: NutritionSource,
    preparation: Preparation,
    scope: Scope,
): ProductNutrition | null {
    const nutriments = product.nutriments ?? {};
    const calories = energyKcal(nutriments, preparation, scope);
    // Energy is the gate: a product without it has no nutrition facts worth
    // importing, and a missing *individual* macro is normal in OFF data.
    if (calories === undefined) return null;

    // Per-serving figures only scale to per-100 g if the serving mass is known.
    const perServing = scope === "serving";
    const servingQuantity = product.serving_quantity ?? 0;
    if (perServing && !(servingQuantity > 0)) return null;
    const factor = perServing ? 100 / servingQuantity : 1;

    const macros = Object.fromEntries(
        Object.entries(MACRO_STEMS).map(([column, stem]) => [
            column,
            round2((nutriment(nutriments, stem, preparation, scope) ?? 0) * factor),
        ]),
    ) as Omit<ProductNutrition, "calories_per_100g" | "prepared">;

    return {
        calories_per_100g: round2(calories * factor),
        ...macros,
        prepared: preparation === "_prepared",
    };
}

/**
 * The per-100 g figures a product yields, or null when it carries none usable —
 * which is what an unchecked `?? 0` used to turn into a plausible 0 kcal food.
 *
 * As-sold values win over prepared ones because `serving_size` and
 * `default_unit` describe the product in the pack: pairing a dry-soup serving
 * with its made-up figures would misprice every entry. Prepared values are the
 * fallback for the products (cordials, powders) whose as-sold facts OFF never
 * recorded. Note that `nutrition_data_prepared_per` is set on plenty of
 * products that have no prepared figures at all, so the values themselves —
 * not that flag — decide.
 *
 * Within a preparation, `*_100g` wins over `*_serving`: OFF normalizes to
 * per-100 g whenever it can, so `nutrition_data_per` describes how a
 * contributor typed the values in, not what `*_100g` means. `*_serving` is only
 * reached for the products that have no per-100 g companion.
 */
export function productNutrition(product: NutritionSource): ProductNutrition | null {
    if (product.no_nutrition_data) return null;
    for (const preparation of ["", "_prepared"] as const) {
        for (const scope of ["100g", "serving"] as const) {
            const nutrition = readNutrition(product, preparation, scope);
            if (nutrition) return nutrition;
        }
    }
    return null;
}
