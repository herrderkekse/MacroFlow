import { getProductByBarcode, hydrateProduct, productToFood, searchProducts, type DerivedServingUnit, type OFFProduct, type ProductImport } from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Keyboard } from "react-native";
import {
    getFoodByBarcode,
    getFoodByOpenfoodfactsId,
    searchFoodsByName,
    type Food,
    type ServingUnit,
} from "../services/templateDb";

/** Dismiss animation of a bottom sheet, before the next one may open. */
const SHEET_SWAP_MS = 300;

/**
 * A food the editor is working with, which may not be in the library yet. An
 * unsaved one carries the serving units its OpenFoodFacts import derived: they
 * belong to a food row that does not exist, so they travel with the draft and
 * are written at `materializeFood` time, along with the food itself.
 */
export type UnsavedFood = Food & { pendingServingUnits?: ServingUnit[] };

/**
 * A food picked from OpenFoodFacts that is not in the library yet. It carries
 * `id: 0` so the rest of the editor can treat it like any other food; the row
 * is only written when the recipe is saved (see `materializeFood`). Its serving
 * units carry `id: 0` for the same reason.
 */
function unsavedFood(imported: Extract<ProductImport, { ok: true }>): UnsavedFood {
    return {
        id: 0,
        ...imported.food,
        last_logged_amount: null,
        last_logged_unit: null,
        last_logged_meal: null,
        deleted: 0,
        uuid: null,
        pendingServingUnits: imported.servingUnits.map(unsavedServingUnit),
    };
}

function unsavedServingUnit(unit: DerivedServingUnit): ServingUnit {
    return { id: 0, food_id: 0, uuid: null, ...unit };
}

/**
 * The "find me a food" half of the recipe editor: the search sheet and the
 * three ways out of it (on-device search, barcode scan, manual entry). Every
 * path ends in `onPickFood`, called once the sheets have been dismissed.
 */
export function useIngredientSearch(onPickFood: (food: UnsavedFood) => void) {
    const { t } = useTranslation();

    const [showSearchSheet, setShowSearchSheet] = useState(false);
    const [foodQuery, setFoodQuery] = useState("");
    const [localResults, setLocalResults] = useState<Food[]>([]);
    const [offResults, setOffResults] = useState<OFFProduct[]>([]);
    const [isSearchingOFF, setIsSearchingOFF] = useState(false);
    const [hasSearchedOFF, setHasSearchedOFF] = useState(false);
    const [offError, setOffError] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [showManualForm, setShowManualForm] = useState(false);

    // What the manual form starts from when an OFF product cannot be imported
    // because it has no nutrition facts: rather than a 0 kcal ingredient, the
    // user gets the form with the name and barcode already in place.
    const [manualPrefill, setManualPrefill] = useState<{
        name: string;
        barcode: string;
    } | null>(null);

    // Kept in a ref so the sheet-dismiss timers always reach the current
    // handler rather than the one captured when the sheet opened.
    const pickRef = useRef(onPickFood);
    useEffect(() => {
        pickRef.current = onPickFood;
    }, [onPickFood]);

    // ── Food search (debounced local) ─────────────────────
    useEffect(() => {
        if (foodQuery.trim().length < 2) {
            queueMicrotask(() => setLocalResults([]));
            return;
        }
        const timer = setTimeout(() => setLocalResults(searchFoodsByName(foodQuery.trim())), 200);
        return () => clearTimeout(timer);
    }, [foodQuery]);

    useEffect(() => {
        queueMicrotask(() => {
            setOffResults([]);
            setOffError(null);
            setHasSearchedOFF(false);
        });
    }, [foodQuery]);

    const handleSearchOFF = useCallback(async () => {
        if (foodQuery.trim().length < 2) return;
        setIsSearchingOFF(true);
        setOffError(null);
        try {
            const results = await searchProducts(foodQuery.trim());
            setOffResults(results);
            setHasSearchedOFF(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("common.searchFailed");
            setOffError(msg);
        } finally {
            setIsSearchingOFF(false);
        }
    }, [foodQuery, t]);

    function openSearchSheet() {
        setFoodQuery("");
        setLocalResults([]);
        setOffResults([]);
        setOffError(null);
        setHasSearchedOFF(false);
        setShowSearchSheet(true);
    }

    function closeSearchSheet() {
        setShowSearchSheet(false);
    }

    /**
     * Two modals must not transition in the same frame, so every hand-off out
     * of the search sheet waits for it to finish dismissing.
     */
    function afterSheetDismissed(action: () => void) {
        closeSearchSheet();
        setTimeout(action, SHEET_SWAP_MS);
    }

    function openScanner() {
        afterSheetDismissed(() => setShowScanner(true));
    }

    function openManualForm() {
        setManualPrefill(null);
        afterSheetDismissed(() => setShowManualForm(true));
    }

    function handleSelectLocal(food: Food) {
        Keyboard.dismiss();
        afterSheetDismissed(() => pickRef.current(food));
    }

    function handleSelectOFF(product: OFFProduct) {
        Keyboard.dismiss();
        const existing = getFoodByOpenfoodfactsId(product.code);
        if (existing) {
            afterSheetDismissed(() => pickRef.current(existing));
            return;
        }
        // A search result carries neither the serving fields nor the full
        // nutriments, so they have to be read from the product API. Started
        // before the hand-off so the fetch runs under the dismiss animation
        // rather than after it; `hydrateProduct` resolves either way.
        const hydrating = hydrateProduct(product);
        afterSheetDismissed(async () => {
            const hydrated = await hydrating;
            const imported = productToFood(hydrated, { fallbackName: t("common.unknown") });
            if (!imported.ok) {
                logger.info("[API] OFF product has no nutrition facts", { code: hydrated.code });
                setManualPrefill({ name: imported.name, barcode: imported.barcode });
                setShowManualForm(true);
                return;
            }
            pickRef.current(unsavedFood(imported));
        });
    }

    function handleManualFoodCreated(food: UnsavedFood) {
        setShowManualForm(false);
        setManualPrefill(null);
        afterSheetDismissed(() => pickRef.current(food));
    }

    function handleBarcodeFound(food: UnsavedFood) {
        setShowScanner(false);
        afterSheetDismissed(() => pickRef.current(food));
    }

    function handleBarcodeNotFound() {
        setShowScanner(false);
        // A product OFF knows but has no nutrition facts for goes to the manual
        // form with what we do know; a barcode OFF has never seen is a dead end.
        if (manualPrefill) {
            setTimeout(() => setShowManualForm(true), SHEET_SWAP_MS);
            return;
        }
        Alert.alert(t("templates.notFound"), t("templates.productNotFound"));
    }

    async function lookupBarcode(barcode: string): Promise<UnsavedFood | null> {
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
            setManualPrefill({ name: imported.name, barcode: imported.barcode });
            return null;
        }
        return unsavedFood(imported);
    }

    return {
        showSearchSheet,
        openSearchSheet,
        closeSearchSheet,
        foodQuery,
        setFoodQuery,
        localResults,
        offResults,
        isSearchingOFF,
        hasSearchedOFF,
        offError,
        handleSearchOFF,
        handleSelectLocal,
        handleSelectOFF,
        showScanner,
        setShowScanner,
        openScanner,
        showManualForm,
        setShowManualForm,
        openManualForm,
        manualName: manualPrefill?.name,
        manualBarcode: manualPrefill?.barcode,
        manualNotice: manualPrefill ? t("common.offMissingNutritionNotice") : null,
        handleManualFoodCreated,
        handleBarcodeFound,
        handleBarcodeNotFound,
        lookupBarcode,
    };
}
