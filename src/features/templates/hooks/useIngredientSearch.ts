import { getProductByBarcode, hydrateServing, productToFood, searchProducts, type OFFProduct } from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Keyboard } from "react-native";
import {
    getFoodByBarcode,
    getFoodByOpenfoodfactsId,
    searchFoodsByName,
    type Food,
} from "../services/templateDb";

/** Dismiss animation of a bottom sheet, before the next one may open. */
const SHEET_SWAP_MS = 300;

/**
 * A food picked from OpenFoodFacts that is not in the library yet. It carries
 * `id: 0` so the rest of the editor can treat it like any other food; the row
 * is only written when the recipe is saved (see `materializeFood`).
 */
function unsavedFoodFromProduct(product: OFFProduct, fallbackName: string): Food {
    return {
        id: 0,
        ...productToFood(product, { fallbackName }),
        last_logged_amount: null,
        last_logged_unit: null,
        last_logged_meal: null,
        deleted: 0,
        uuid: null,
    };
}

/**
 * The "find me a food" half of the recipe editor: the search sheet and the
 * three ways out of it (on-device search, barcode scan, manual entry). Every
 * path ends in `onPickFood`, called once the sheets have been dismissed.
 */
export function useIngredientSearch(onPickFood: (food: Food) => void) {
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
        // A search result carries no serving fields, so they have to be read
        // from the product API. Started before the hand-off so the fetch runs
        // under the dismiss animation rather than after it; `hydrateServing`
        // resolves either way.
        const hydrating = hydrateServing(product);
        afterSheetDismissed(async () => {
            const hydrated = await hydrating;
            pickRef.current(unsavedFoodFromProduct(hydrated, t("common.unknown")));
        });
    }

    function handleManualFoodCreated(food: Food) {
        setShowManualForm(false);
        afterSheetDismissed(() => pickRef.current(food));
    }

    function handleBarcodeFound(food: Food) {
        setShowScanner(false);
        afterSheetDismissed(() => pickRef.current(food));
    }

    function handleBarcodeNotFound() {
        setShowScanner(false);
        Alert.alert(t("templates.notFound"), t("templates.productNotFound"));
    }

    async function lookupBarcode(barcode: string): Promise<Food | null> {
        const local = getFoodByBarcode(barcode);
        if (local) {
            logger.info("[SCAN] Found locally", { id: local.id });
            return local;
        }
        const product = await getProductByBarcode(barcode);
        if (!product) return null;
        return getFoodByOpenfoodfactsId(product.code)
            ?? unsavedFoodFromProduct(product, t("common.unknown"));
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
        handleManualFoodCreated,
        handleBarcodeFound,
        handleBarcodeNotFound,
        lookupBarcode,
    };
}
