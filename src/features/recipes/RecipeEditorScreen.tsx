import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Keyboard,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";
import {
    addRecipe,
    updateRecipe,
    getRecipeById,
    getRecipeItems,
    addRecipeItem,
    updateRecipeItem,
    deleteRecipeItem,
    searchFoodsByName,
    getFoodByOpenfoodfactsId,
    addFood,
    type Food,
    type Recipe,
    type RecipeItem,
} from "@/src/db/queries";
import { searchProducts, type OFFProduct } from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import BarcodeScannerView from "@/src/features/log/BarcodeScannerView";

interface ItemWithFood {
    recipeItem: RecipeItem;
    food: Food | null;
}

export default function RecipeEditorScreen() {
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

    // editing item quantity inline
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [editingQty, setEditingQty] = useState("");

    // Flush any in-progress quantity edit to DB + state
    function saveCurrentEdit() {
        if (editingItemId == null) return;
        const q = parseFloat(editingQty) || 0;
        if (q > 0) {
            updateRecipeItem(editingItemId, { quantity_grams: q });
            setItems((prev) =>
                prev.map((i) =>
                    i.recipeItem.id === editingItemId
                        ? { ...i, recipeItem: { ...i.recipeItem, quantity_grams: q } }
                        : i,
                ),
            );
        }
        setEditingItemId(null);
    }

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
        });
        addItemForFood(food);
    }

    function addItemForFood(food: Food) {
        saveCurrentEdit();
        const rid = ensureRecipe();
        const ri = addRecipeItem({ recipe_id: rid, food_id: food.id, quantity_grams: 100 });
        setItems((prev) => [...prev, { recipeItem: ri, food }]);
        setFoodQuery("");
        setLocalResults([]);
        setOffResults([]);
        // Auto-open the quantity editor for the new item
        setEditingItemId(ri.id);
        setEditingQty("100");
    }

    // ── Item editing ──────────────────────────────────────
    function handleSaveItemQty(itemId: number) {
        const q = parseFloat(editingQty) || 0;
        if (q <= 0) return;
        updateRecipeItem(itemId, { quantity_grams: q });
        setItems((prev) =>
            prev.map((i) =>
                i.recipeItem.id === itemId
                    ? { ...i, recipeItem: { ...i.recipeItem, quantity_grams: q } }
                    : i,
            ),
        );
        setEditingItemId(null);
    }

    function startEditingItem(itemId: number, currentQty: number) {
        saveCurrentEdit();
        setEditingItemId(itemId);
        setEditingQty(String(currentQty));
    }

    function handleDeleteItem(itemId: number) {
        deleteRecipeItem(itemId);
        setItems((prev) => prev.filter((i) => i.recipeItem.id !== itemId));
    }

    // ── Save & back ───────────────────────────────────────
    function handleDone() {
        saveCurrentEdit();
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
                {items.map(({ recipeItem, food }) => {
                    const isEditingThis = editingItemId === recipeItem.id;
                    const cals = food
                        ? Math.round((food.calories_per_100g * recipeItem.quantity_grams) / 100)
                        : 0;
                    return (
                        <View key={recipeItem.id} style={styles.itemRow}>
                            <Pressable
                                style={styles.itemInfo}
                                onPress={() => startEditingItem(recipeItem.id, recipeItem.quantity_grams)}
                            >
                                <Text style={styles.itemName} numberOfLines={1}>
                                    {food?.name ?? "Unknown"}
                                </Text>
                                {isEditingThis ? (
                                    <View style={styles.qtyEditRow}>
                                        <TextInput
                                            style={styles.qtyInput}
                                            value={editingQty}
                                            onChangeText={setEditingQty}
                                            keyboardType="decimal-pad"
                                            autoFocus
                                            selectTextOnFocus
                                            onSubmitEditing={() => handleSaveItemQty(recipeItem.id)}
                                            onBlur={() => handleSaveItemQty(recipeItem.id)}
                                        />
                                        <Text style={styles.itemDetail}>g</Text>
                                        <Pressable onPress={() => handleSaveItemQty(recipeItem.id)} hitSlop={8}>
                                            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                                        </Pressable>
                                    </View>
                                ) : (
                                    <Text style={styles.itemDetail}>
                                        {recipeItem.quantity_grams}g · {cals} cal
                                    </Text>
                                )}
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

const styles = StyleSheet.create({
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
    qtyEditRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 },
    qtyInput: {
        fontSize: fontSize.sm,
        color: colors.text,
        borderBottomWidth: 1,
        borderBottomColor: colors.primary,
        minWidth: 50,
        paddingVertical: 2,
        paddingHorizontal: 4,
    },
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
