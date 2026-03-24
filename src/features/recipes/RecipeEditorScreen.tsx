import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import {
    addFood,
    addRecipe,
    addRecipeItem,
    deleteRecipeItem,
    getFoodByOpenfoodfactsId,
    getRecipeById,
    getRecipeItems,
    searchFoodsByName,
    updateRecipe,
    type Food,
    type RecipeItem
} from "@/src/db/queries";
import BarcodeScannerView from "@/src/features/log/BarcodeScannerView";
import RecipeItemModal from "@/src/features/recipes/RecipeItemModal";
import { guessUnit, parseServingSize, searchProducts, type OFFProduct } from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { fromGrams, toGrams, unitLabel, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";

interface ItemWithFood {
    recipeItem: RecipeItem;
    food: Food | null;
}

export default function RecipeEditorScreen() {
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
    const isEditing = !!recipeId;

    const [name, setName] = useState("");
    const [items, setItems] = useState<ItemWithFood[]>([]);

    // food search
    const [foodQuery, setFoodQuery] = useState("");
    const [localResults, setLocalResults] = useState<Food[]>([]);
    const [offResults, setOffResults] = useState<OFFProduct[]>([]);
    const [isSearchingOFF, setIsSearchingOFF] = useState(false);
    const [hasSearchedOFF, setHasSearchedOFF] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

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
        setItems(rows.map((r) => ({ recipeItem: r.recipe_items, food: r.foods })));
    }

    // ── Save recipe name ──────────────────────────────────
    function ensureRecipe(): number {
        if (recipeId) {
            updateRecipe(Number(recipeId), name.trim());
            return Number(recipeId);
        }
        const r = addRecipe(name.trim() || "Untitled recipe");
        logger.info("[DB] Created recipe", { id: r.id });
        // push the id into params so subsequent saves update instead of re-creating
        router.setParams({ recipeId: String(r.id) });
        return r.id;
    }

    // ── Food search (debounced local) ─────────────────────
    useEffect(() => {
        if (foodQuery.trim().length < 2) { setLocalResults([]); return; }
        const t = setTimeout(() => setLocalResults(searchFoodsByName(foodQuery.trim())), 200);
        return () => clearTimeout(t);
    }, [foodQuery]);

    useEffect(() => {
        setOffResults([]);
        setHasSearchedOFF(false);
    }, [foodQuery]);

    const handleSearchOFF = useCallback(async () => {
        if (foodQuery.trim().length < 2) return;
        setIsSearchingOFF(true);
        try {
            const results = await searchProducts(foodQuery.trim());
            setOffResults(results);
            setHasSearchedOFF(true);
        } catch { /* ignore */ } finally {
            setIsSearchingOFF(false);
        }
    }, [foodQuery]);

    function handleSelectLocal(food: Food) {
        Keyboard.dismiss();
        addItemForFood(food);
    }

    function handleBarcodeFound(food: Food) {
        setShowScanner(false);
        setTimeout(() => addItemForFood(food), 300);
    }

    function handleBarcodeNotFound() {
        setShowScanner(false);
        Alert.alert("Not found", "Product not found for barcode");
    }

    function handleSelectOFF(product: OFFProduct) {
        Keyboard.dismiss();
        const existing = getFoodByOpenfoodfactsId(product.code);
        if (existing) { addItemForFood(existing); return; }
        const n = product.product_name || "Unknown";
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

    function addItemForFood(food: Food) {
        const rid = ensureRecipe();
        const foodUnit = (food.default_unit ?? "g") as FoodUnit;
        const servingSize = food.serving_size ?? 100;
        const qtyGrams = toGrams(servingSize, foodUnit);
        const ri = addRecipeItem({ recipe_id: rid, food_id: food.id, quantity_grams: qtyGrams, quantity_unit: foodUnit });
        const newEntry: ItemWithFood = { recipeItem: ri, food };
        setItems((prev) => [...prev, newEntry]);
        setFoodQuery("");
        setLocalResults([]);
        setOffResults([]);
        // Auto-open the modal editor for the new item
        setEditingItem(newEntry);
    }

    // ── Item editing ──────────────────────────────────────
    function handleModalSaved(itemId: number, quantityGrams: number, unit: FoodUnit) {
        setItems((prev) =>
            prev.map((i) =>
                i.recipeItem.id === itemId
                    ? { ...i, recipeItem: { ...i.recipeItem, quantity_grams: quantityGrams, quantity_unit: unit } }
                    : i,
            ),
        );
        setEditingItem(null);
    }

    function handleDeleteItem(itemId: number) {
        deleteRecipeItem(itemId);
        setItems((prev) => prev.filter((i) => i.recipeItem.id !== itemId));
    }

    // ── Save & back ───────────────────────────────────────
    function handleDone() {
        if (name.trim()) {
            ensureRecipe();
        }
        router.back();
    }

    const totalCals = items.reduce((sum, { recipeItem, food }) => {
        if (!food) return sum;
        return sum + (food.calories_per_100g * recipeItem.quantity_grams) / 100;
    }, 0);

    return (
        <View style={styles.screen}>
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* Recipe name */}
                <Input
                    label="Recipe name"
                    placeholder="e.g. Morning Smoothie"
                    value={name}
                    onChangeText={setName}
                    containerStyle={styles.nameInput}
                />

                {/* Summary */}
                <Text style={styles.summary}>
                    {items.length} item{items.length !== 1 ? "s" : ""} · {Math.round(totalCals)} cal total
                </Text>

                {/* Items */}
                {items.map((itemWithFood) => {
                    const { recipeItem, food } = itemWithFood;
                    const itemUnit = (recipeItem.quantity_unit ?? "g") as FoodUnit;
                    const displayQty = Math.round(fromGrams(recipeItem.quantity_grams, itemUnit) * 10) / 10;
                    const cals = food
                        ? Math.round((food.calories_per_100g * recipeItem.quantity_grams) / 100)
                        : 0;
                    return (
                        <View key={recipeItem.id} style={styles.itemRow}>
                            <Pressable
                                style={styles.itemInfo}
                                onPress={() => setEditingItem(itemWithFood)}
                            >
                                <Text style={styles.itemName} numberOfLines={1}>
                                    {food?.name ?? "Unknown"}
                                </Text>
                                <Text style={styles.itemDetail}>
                                    {displayQty} {unitLabel(itemUnit)} · {cals} cal
                                </Text>
                            </Pressable>
                            <Pressable onPress={() => handleDeleteItem(recipeItem.id)} hitSlop={8}>
                                <Ionicons name="close-circle-outline" size={20} color={colors.textTertiary} />
                            </Pressable>
                        </View>
                    );
                })}

                {/* Add food search */}
                <Text style={styles.sectionLabel}>Add ingredient</Text>
                <View style={styles.searchRow}>
                    <Ionicons name="search" size={18} color={colors.textTertiary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search foods…"
                        placeholderTextColor={colors.textTertiary}
                        value={foodQuery}
                        onChangeText={setFoodQuery}
                    />
                    {foodQuery.length > 0 && (
                        <Pressable onPress={() => setFoodQuery("")} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </Pressable>
                    )}
                </View>

                <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
                    <Button
                        title="Scan Barcode"
                        variant="outline"
                        icon={<Ionicons name="barcode-outline" size={18} color={colors.text} />}
                        onPress={() => setShowScanner(true)}
                    />
                </View>

                {/* Local results */}
                {localResults.map((food) => (
                    <Pressable
                        key={food.id}
                        style={styles.resultRow}
                        onPress={() => handleSelectLocal(food)}
                    >
                        <Text style={styles.resultName} numberOfLines={1}>{food.name}</Text>
                        <Text style={styles.resultDetail}>
                            {Math.round(food.calories_per_100g)} cal/100g
                        </Text>
                    </Pressable>
                ))}

                {/* OFF search button */}
                {foodQuery.trim().length >= 2 && !hasSearchedOFF && (
                    <Button
                        title={isSearchingOFF ? "Searching…" : "Search OpenFoodFacts"}
                        onPress={handleSearchOFF}
                        variant="outline"
                        loading={isSearchingOFF}
                        style={styles.offBtn}
                    />
                )}

                {offResults.map((p) => (
                    <Pressable
                        key={p.code}
                        style={styles.resultRow}
                        onPress={() => handleSelectOFF(p)}
                    >
                        <Text style={styles.resultName} numberOfLines={1}>
                            {p.product_name || "Unknown"}{" "}
                            <Ionicons name="globe-outline" size={12} color={colors.textTertiary} />
                        </Text>
                        <Text style={styles.resultDetail}>
                            {Math.round(p.nutriments?.["energy-kcal_100g"] ?? 0)} cal/100g
                        </Text>
                    </Pressable>
                ))}

                <Button title="Done" onPress={handleDone} style={styles.doneBtn} />

                <RecipeItemModal
                    item={editingItem?.recipeItem ?? null}
                    food={editingItem?.food ?? null}
                    onClose={() => setEditingItem(null)}
                    onSaved={handleModalSaved}
                />

                <BarcodeScannerView
                    visible={showScanner}
                    onClose={() => setShowScanner(false)}
                    onFoodFound={handleBarcodeFound}
                    onNotFound={handleBarcodeNotFound}
                />
            </ScrollView>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: 100 },
        nameInput: { marginBottom: spacing.md },
        summary: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        itemRow: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.xs,
        },
        itemInfo: { flex: 1, marginRight: spacing.sm },
        itemName: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text },
        itemDetail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
        },
        searchRow: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.sm,
        },
        searchInput: {
            flex: 1,
            fontSize: fontSize.md,
            color: colors.text,
            padding: 0,
        },
        resultRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        resultName: { flex: 1, fontSize: fontSize.sm, color: colors.text, marginRight: spacing.sm },
        resultDetail: { fontSize: fontSize.xs, color: colors.textSecondary },
        offBtn: { marginTop: spacing.sm },
        doneBtn: { marginTop: spacing.lg },
    });
}
