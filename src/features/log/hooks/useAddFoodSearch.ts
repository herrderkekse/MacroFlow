import { getRecipeGroups, type RecipeGroup } from "@/src/features/templates/services/recipeVariantsDb";
import {
    addFood,
    getFoodByBarcode,
    getFoodByOpenfoodfactsId,
    searchFoodsByName,
    type Food,
    type Recipe,
} from "@/src/features/templates/services/templateDb";
import {
    getProductByBarcode,
    guessUnit,
    parseServingSize,
    searchProducts,
    type OFFProduct,
} from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard } from "react-native";

export function useAddFoodSearch() {
    const { t } = useTranslation();

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
    const [pendingBarcode, setPendingBarcode] = useState<string | undefined>(undefined);

    // ── Recipe search (variants grouped under their base, collapsed) ──
    const [recipeResults, setRecipeResults] = useState<RecipeGroup[]>([]);
    const [expandedRecipeIds, setExpandedRecipeIds] = useState<Set<number>>(new Set());

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

    function handleSelectOFF(product: OFFProduct) {
        Keyboard.dismiss();
        const existing = getFoodByOpenfoodfactsId(product.code);
        if (existing) {
            setSelectedFood(existing);
            return;
        }
        const food = addFood({
            name: product.product_name ?? t("common.unknown"),
            calories_per_100g: product.nutriments?.["energy-kcal_100g"] ?? 0,
            protein_per_100g: product.nutriments?.proteins_100g ?? 0,
            carbs_per_100g: product.nutriments?.carbohydrates_100g ?? 0,
            fat_per_100g: product.nutriments?.fat_100g ?? 0,
            openfoodfacts_id: product.code,
            source: "openfoodfacts",
            default_unit: guessUnit(product),
            serving_size: parseServingSize(product),
        });
        logger.info("[DB] Created food from OFF search", { id: food.id, name: food.name });
        setSelectedFood(food);
    }

    async function lookupBarcode(barcode: string): Promise<Food | null> {
        const local = getFoodByBarcode(barcode);
        if (local) {
            logger.info("[SCAN] Found locally", { id: local.id });
            return local;
        }
        const product = await getProductByBarcode(barcode);
        if (!product) return null;
        const existing = getFoodByOpenfoodfactsId(product.code);
        if (existing) return existing;
        const food = addFood({
            name: product.product_name ?? t("common.unknown"),
            calories_per_100g: product.nutriments?.["energy-kcal_100g"] ?? 0,
            protein_per_100g: product.nutriments?.proteins_100g ?? 0,
            carbs_per_100g: product.nutriments?.carbohydrates_100g ?? 0,
            fat_per_100g: product.nutriments?.fat_100g ?? 0,
            barcode,
            openfoodfacts_id: product.code,
            source: "openfoodfacts",
        });
        logger.info("[DB] Created food from barcode", { id: food.id, name: food.name });
        return food;
    }

    function handleFoodCreated(food: Food) {
        setShowManualForm(false);
        setPendingBarcode(undefined);
        setTimeout(() => setSelectedFood(food), 300);
    }

    function handleBarcodeFound(food: Food) {
        setShowScanner(false);
        setTimeout(() => setSelectedFood(food), 300);
    }

    function handleBarcodeNotFound(barcode: string) {
        setShowScanner(false);
        setPendingBarcode(barcode);
        setTimeout(() => setShowManualForm(true), 300);
    }

    function handleCloseManualForm() {
        setShowManualForm(false);
        setPendingBarcode(undefined);
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
        setShowManualForm,
        pendingBarcode,
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
