import { getProductByBarcode, guessUnit, parseServingSize, searchProducts, type OFFProduct } from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import type { FoodUnit } from "@/src/utils/units";
import { toGrams } from "@/src/utils/units";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Keyboard } from "react-native";
import {
    addFood,
    addRecipe,
    addRecipeItem,
    deleteRecipeItem,
    getFoodByBarcode,
    getFoodByOpenfoodfactsId,
    getRecipeById,
    getRecipeItems,
    getServingUnits,
    searchFoodsByName,
    updateRecipe,
    type Food,
    type RecipeItem,
    type ServingUnit,
} from "../services/templateDb";

export interface ItemWithFood {
    recipeItem: RecipeItem;
    food: Food | null;
    servingUnits: ServingUnit[];
}

export function useRecipeEditor() {
    const { t } = useTranslation();
    const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
    const isEditing = !!recipeId;
    const recipeIdRef = useRef(recipeId);
    recipeIdRef.current = recipeId;

    const [name, setName] = useState("");
    const [items, setItems] = useState<ItemWithFood[]>([]);

    // food search
    const [foodQuery, setFoodQuery] = useState("");
    const [localResults, setLocalResults] = useState<Food[]>([]);
    const [offResults, setOffResults] = useState<OFFProduct[]>([]);
    const [isSearchingOFF, setIsSearchingOFF] = useState(false);
    const [hasSearchedOFF, setHasSearchedOFF] = useState(false);
    const [offError, setOffError] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [showManualForm, setShowManualForm] = useState(false);

    // modal for editing an ingredient's quantity + unit
    const [editingItem, setEditingItem] = useState<ItemWithFood | null>(null);

    // ── Load existing recipe ──────────────────────────────
    useEffect(() => {
        if (!recipeId) return;
        const recipe = getRecipeById(Number(recipeId));
        if (recipe) setName(recipe.name);
        loadItems(Number(recipeId));
    }, [recipeId]);

    function loadItems(id: number) {
        const rows = getRecipeItems(id);
        setItems(rows.map((r) => ({
            recipeItem: r.recipe_items,
            food: r.foods,
            servingUnits: r.foods ? getServingUnits(r.foods.id) : [],
        })));
    }

    function ensureRecipe(): number {
        if (recipeIdRef.current) {
            updateRecipe(Number(recipeIdRef.current), name.trim());
            return Number(recipeIdRef.current);
        }
        const r = addRecipe(name.trim() || "Untitled recipe");
        logger.info("[DB] Created recipe", { id: r.id });
        router.setParams({ recipeId: String(r.id) });
        return r.id;
    }

    // ── Food search (debounced local) ─────────────────────
    useEffect(() => {
        if (foodQuery.trim().length < 2) { setLocalResults([]); return; }
        const timer = setTimeout(() => setLocalResults(searchFoodsByName(foodQuery.trim())), 200);
        return () => clearTimeout(timer);
    }, [foodQuery]);

    useEffect(() => {
        setOffResults([]);
        setOffError(null);
        setHasSearchedOFF(false);
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

    function handleSelectLocal(food: Food) {
        Keyboard.dismiss();
        addItemForFood(food);
    }

    function handleManualFoodCreated(food: Food) {
        setShowManualForm(false);
        setTimeout(() => addItemForFood(food), 300);
    }

    function handleBarcodeFound(food: Food) {
        setShowScanner(false);
        setTimeout(() => addItemForFood(food), 300);
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

    function handleSelectOFF(product: OFFProduct) {
        Keyboard.dismiss();
        const existing = getFoodByOpenfoodfactsId(product.code);
        if (existing) { addItemForFood(existing); return; }
        const n = product.product_name || t("common.unknown");
        const nu = product.nutriments ?? {};
        const food = addFood({
            name: n,
            calories_per_100g: nu["energy-kcal_100g"] ?? 0,
            protein_per_100g: nu.proteins_100g ?? 0,
            carbs_per_100g: nu.carbohydrates_100g ?? 0,
            fat_per_100g: nu.fat_100g ?? 0,
            openfoodfacts_id: product.code,
            source: "openfoodfacts",
            default_unit: guessUnit(product),
            serving_size: parseServingSize(product),
        });
        addItemForFood(food);
    }

    function addItemForFood(food: Food): ItemWithFood {
        const rid = ensureRecipe();
        const foodUnit = (food.default_unit ?? "g") as FoodUnit;
        const servingSize = food.serving_size ?? 100;
        const qtyGrams = toGrams(servingSize, foodUnit);
        const ri = addRecipeItem({ recipe_id: rid, food_id: food.id, quantity_grams: qtyGrams, quantity_unit: foodUnit });
        const sUnits = getServingUnits(food.id);
        const newEntry: ItemWithFood = { recipeItem: ri, food, servingUnits: sUnits };
        setItems((prev) => [...prev, newEntry]);
        setFoodQuery("");
        setLocalResults([]);
        setOffResults([]);
        setEditingItem(newEntry);
        return newEntry;
    }

    function handleModalSaved(itemId: number, quantityGrams: number, unit: string) {
        setItems((prev) =>
            prev.map((i) => {
                if (i.recipeItem.id !== itemId) return i;
                const freshServingUnits = i.food ? getServingUnits(i.food.id) : i.servingUnits;
                return {
                    ...i,
                    recipeItem: { ...i.recipeItem, quantity_grams: quantityGrams, quantity_unit: unit },
                    servingUnits: freshServingUnits,
                };
            }),
        );
        setEditingItem(null);
    }

    function handleDeleteItem(itemId: number) {
        deleteRecipeItem(itemId);
        setItems((prev) => prev.filter((i) => i.recipeItem.id !== itemId));
    }

    function handleDone() {
        if (name.trim()) ensureRecipe();
        router.back();
    }

    const totalCals = items.reduce((sum, { recipeItem, food }) => {
        if (!food) return sum;
        return sum + (food.calories_per_100g * recipeItem.quantity_grams) / 100;
    }, 0);

    return {
        isEditing,
        name,
        setName,
        items,
        totalCals,
        foodQuery,
        setFoodQuery,
        localResults,
        offResults,
        isSearchingOFF,
        hasSearchedOFF,
        offError,
        showScanner,
        setShowScanner,
        showManualForm,
        setShowManualForm,
        editingItem,
        setEditingItem,
        handleSearchOFF,
        handleSelectLocal,
        handleManualFoodCreated,
        handleBarcodeFound,
        handleBarcodeNotFound,
        lookupBarcode,
        handleSelectOFF,
        handleModalSaved,
        handleDeleteItem,
        handleDone,
    };
}
