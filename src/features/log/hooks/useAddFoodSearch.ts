import { getRecipeGroups, type RecipeGroup } from "@/src/features/templates/services/recipeVariantsDb";
import {
    addFoodWithServingUnits,
    getFoodByBarcode,
    getFoodByOpenfoodfactsId,
    getRecipeById,
    searchFoodsByName,
    type Food,
    type Recipe,
} from "@/src/features/templates/services/templateDb";
import {
    getProductByBarcode,
    hydrateProduct,
    productToFood,
    searchProducts,
    type OFFProduct,
} from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard } from "react-native";

export function useAddFoodSearch() {
    const { t } = useTranslation();
    // Set when arriving from "Save & log" in the recipe editor: the recipe is
    // preselected so the user only picks the amount and the meal.
    const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();

    // ── Search state ───────────────────────────────────────
    const [query, setQuery] = useState("");
    const [localResults, setLocalResults] = useState<Food[]>([]);
    const [offResults, setOffResults] = useState<OFFProduct[]>([]);
    const [isSearchingOFF, setIsSearchingOFF] = useState(false);
    const [offError, setOffError] = useState<string | null>(null);
    const [hasSearchedOFF, setHasSearchedOFF] = useState(false);

    // ── Modal / selection state ────────────────────────────
    const [selectedFood, setSelectedFood] = useState<Food | null>(null);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [showManualForm, setShowManualForm] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const isSelectingOFF = useRef(false);

    // What the manual form should start from. Set when a scan finds no product
    // (barcode only) or when OFF knows the product but has no nutrition facts
    // for it — the latter would otherwise import as a 0 kcal food, so we hand
    // the user the name and barcode and let them fill in the numbers.
    const [manualPrefill, setManualPrefill] = useState<{
        name?: string;
        barcode?: string;
        missingNutrition?: boolean;
    } | null>(null);

    // ── Recipe search (variants grouped under their base, collapsed) ──
    const [recipeResults, setRecipeResults] = useState<RecipeGroup[]>([]);
    const [expandedRecipeIds, setExpandedRecipeIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!recipeId) return;
        queueMicrotask(() => {
            const recipe = getRecipeById(Number(recipeId));
            if (recipe) setSelectedRecipe(recipe);
        });
    }, [recipeId]);

    useEffect(() => {
        if (query.trim().length < 2) { queueMicrotask(() => setRecipeResults([])); return; }
        const timer = setTimeout(() => {
            setExpandedRecipeIds(new Set());
            setRecipeResults(getRecipeGroups(query.trim()));
        }, 200);
        return () => clearTimeout(timer);
    }, [query]);

    function toggleRecipeExpanded(recipeId: number) {
        setExpandedRecipeIds((prev) => {
            const next = new Set(prev);
            if (next.has(recipeId)) next.delete(recipeId);
            else next.add(recipeId);
            return next;
        });
    }

    // ── Local search (debounced, search-as-you-type) ──────
    useEffect(() => {
        if (query.trim().length < 2) {
            queueMicrotask(() => setLocalResults([]));
            return;
        }
        const timer = setTimeout(() => {
            const results = searchFoodsByName(query.trim());
            setLocalResults(results);
        }, 200);
        return () => clearTimeout(timer);
    }, [query]);

    // Reset OFF results when query changes
    useEffect(() => {
        queueMicrotask(() => {
            setOffResults([]);
            setOffError(null);
            setHasSearchedOFF(false);
        });
    }, [query]);

    // ── OpenFoodFacts search (user-triggered) ─────────────
    const handleSearchOFF = useCallback(async () => {
        if (query.trim().length < 2) return;
        setIsSearchingOFF(true);
        setOffError(null);
        try {
            const results = await searchProducts(query.trim());
            setOffResults(results);
            setHasSearchedOFF(true);
            logger.info("[API] OFF search returned", { count: results.length });
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("common.searchFailed");
            setOffError(msg);
        } finally {
            setIsSearchingOFF(false);
        }
    }, [query, t]);

    // ── Handlers ───────────────────────────────────────────

    function handleSelectLocal(food: Food) {
        Keyboard.dismiss();
        setSelectedFood(food);
    }

    async function handleSelectOFF(product: OFFProduct) {
        Keyboard.dismiss();
        const existing = getFoodByOpenfoodfactsId(product.code);
        if (existing) {
            setSelectedFood(existing);
            return;
        }
        // Hydrating the serving fields is a round-trip, so a second tap could
        // land before the food row exists and create it twice.
        if (isSelectingOFF.current) return;
        isSelectingOFF.current = true;
        try {
            const hydrated = await hydrateProduct(product);
            const imported = productToFood(hydrated, { fallbackName: t("common.unknown") });
            if (!imported.ok) {
                logger.info("[API] OFF product has no nutrition facts", { code: hydrated.code });
                setManualPrefill({
                    name: imported.name,
                    barcode: imported.barcode,
                    missingNutrition: true,
                });
                setShowManualForm(true);
                return;
            }
            const food = addFoodWithServingUnits(imported.food, imported.servingUnits);
            logger.info("[DB] Created food from OFF search", { id: food.id, name: food.name });
            setSelectedFood(food);
        } finally {
            isSelectingOFF.current = false;
        }
    }

    /**
     * A scan resolves to a food, or to null so the scanner can offer manual
     * entry. A product OFF knows but has no nutrition facts for takes the
     * second route, with `manualPrefill` carrying the name it does know.
     */
    async function lookupBarcode(barcode: string): Promise<Food | null> {
        setManualPrefill(null);
        const local = getFoodByBarcode(barcode);
        if (local) {
            logger.info("[SCAN] Found locally", { id: local.id });
            return local;
        }
        const product = await getProductByBarcode(barcode);
        if (!product) return null;
        const existing = getFoodByOpenfoodfactsId(product.code);
        if (existing) return existing;
        const imported = productToFood(product, { fallbackName: t("common.unknown") });
        if (!imported.ok) {
            logger.info("[SCAN] OFF product has no nutrition facts", { barcode });
            setManualPrefill({
                name: imported.name,
                barcode: imported.barcode,
                missingNutrition: true,
            });
            return null;
        }
        const food = addFoodWithServingUnits(imported.food, imported.servingUnits);
        logger.info("[DB] Created food from barcode", { id: food.id, name: food.name });
        return food;
    }

    function handleFoodCreated(food: Food) {
        setShowManualForm(false);
        setManualPrefill(null);
        setTimeout(() => setSelectedFood(food), 300);
    }

    function handleBarcodeFound(food: Food) {
        setShowScanner(false);
        setTimeout(() => setSelectedFood(food), 300);
    }

    function handleBarcodeNotFound(barcode: string) {
        setShowScanner(false);
        // Keeps the name from a nutrition-less OFF product, if the lookup found one.
        setManualPrefill((prev) => ({ ...prev, barcode }));
        setTimeout(() => setShowManualForm(true), 300);
    }

    function handleCloseManualForm() {
        setShowManualForm(false);
        setManualPrefill(null);
    }

    /** "Create New": a blank form, whatever an earlier scan left behind. */
    function openManualForm() {
        setManualPrefill(null);
        setShowManualForm(true);
    }

    function handleEntrySaved() {
        setSelectedFood(null);
        router.back();
    }

    // ── Computed ───────────────────────────────────────────
    const localOffIds = new Set(
        localResults.map((f) => f.openfoodfacts_id).filter(Boolean),
    );
    const filteredOFF = offResults.filter((p) => !localOffIds.has(p.code));
    const showLocalSection = query.trim().length >= 2;

    // The manual form opens either pre-filled from a product or blank from the
    // "Create New" button, in which case the search query is the best guess.
    const manualName = manualPrefill?.name ?? query.trim();
    const manualNotice = manualPrefill?.missingNutrition
        ? t("common.offMissingNutritionNotice")
        : null;

    return {
        query,
        setQuery,
        localResults,
        recipeResults,
        expandedRecipeIds,
        toggleRecipeExpanded,
        offResults: filteredOFF,
        isSearchingOFF,
        offError,
        hasSearchedOFF,
        selectedFood,
        setSelectedFood,
        selectedRecipe,
        setSelectedRecipe,
        showManualForm,
        openManualForm,
        manualName,
        manualBarcode: manualPrefill?.barcode,
        manualNotice,
        showScanner,
        setShowScanner,
        showLocalSection,
        handleSearchOFF,
        handleSelectLocal,
        handleSelectOFF,
        handleFoodCreated,
        handleBarcodeFound,
        handleBarcodeNotFound,
        handleCloseManualForm,
        handleEntrySaved,
        lookupBarcode,
    };
}
