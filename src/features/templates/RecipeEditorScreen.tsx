import BottomSheet, { type BottomSheetRef } from "@/src/components/BottomSheet";
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
    getServingUnits,
    searchFoodsByName,
    updateRecipe,
    type Food,
    type RecipeItem,
    type ServingUnit,
} from "@/src/db/queries";
import BarcodeScannerView from "@/src/features/log/BarcodeScannerView";
import ManualFoodForm from "@/src/features/log/ManualFoodForm";
import RecipeItemModal from "@/src/features/templates/RecipeItemModal";
import { guessUnit, parseServingSize, searchProducts, type OFFProduct } from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { fromGrams, toGrams, unitLabel, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View
} from "react-native";

interface ItemWithFood {
    recipeItem: RecipeItem;
    food: Food | null;
    servingUnits: ServingUnit[];
}

const SHEET_COLLAPSED = 160;

export default function RecipeEditorScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
    const { height: screenHeight } = useWindowDimensions();
    const sheetRef = useRef<BottomSheetRef>(null);
    const snapPoints = useMemo(() => [SHEET_COLLAPSED, Math.round(screenHeight * 0.8)], [screenHeight]);
    const isEditing = !!recipeId;

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

    // bottom-sheet helpers
    const handleSearchFocus = useCallback(() => {
        sheetRef.current?.snapTo(1);
    }, []);

    const handleSheetSnapChange = useCallback((index: number) => {
        if (index === 0) Keyboard.dismiss();
    }, []);

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

    function addItemForFood(food: Food) {
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
        // Collapse the bottom sheet and open the modal editor
        sheetRef.current?.snapTo(0);
        setEditingItem(newEntry);
    }

    // ── Item editing ──────────────────────────────────────
    function handleModalSaved(itemId: number, quantityGrams: number, unit: string) {
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
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: colors.surface },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                    title: isEditing
                        ? t("templates.recipeEditorTitle")
                        : t("templates.newRecipeTitle"),
                }}
            />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* Recipe name */}
                <Input
                    label={t("templates.recipeName")}
                    placeholder={t("templates.recipeNamePlaceholder")}
                    value={name}
                    onChangeText={setName}
                    containerStyle={styles.nameInput}
                />

                {/* Summary */}
                <Text style={styles.summary}>
                    {t("common.itemCount", { count: items.length })} · {Math.round(totalCals)} {t("common.cal")}
                </Text>

                {/* Items */}
                {items.slice().reverse().map((itemWithFood) => {
                    const { recipeItem, food, servingUnits } = itemWithFood;
                    const matchedServing = servingUnits.find((s) => s.name === recipeItem.quantity_unit);
                    let displayQty: number;
                    let displayUnit: string;
                    if (matchedServing) {
                        displayQty = Math.round((recipeItem.quantity_grams / matchedServing.grams) * 10) / 10;
                        displayUnit = matchedServing.name;
                    } else {
                        const itemUnit = (recipeItem.quantity_unit ?? "g") as FoodUnit;
                        displayQty = Math.round(fromGrams(recipeItem.quantity_grams, itemUnit) * 10) / 10;
                        displayUnit = unitLabel(itemUnit);
                    }
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
                                    {food?.name ?? t("common.unknown")}
                                </Text>
                                <Text style={styles.itemDetail}>
                                    {displayQty} {displayUnit} · {cals} {t("common.cal")}
                                </Text>
                            </Pressable>
                            <Pressable onPress={() => handleDeleteItem(recipeItem.id)} hitSlop={8}>
                                <Ionicons name="close-circle-outline" size={20} color={colors.textTertiary} />
                            </Pressable>
                        </View>
                    );
                })}

                <Button title={t("common.done")} onPress={handleDone} style={styles.doneBtn} />
            </ScrollView>

            {/* ── Add-ingredient bottom sheet ────────────── */}
            <BottomSheet
                ref={sheetRef}
                snapPoints={snapPoints}
                onSnapChange={handleSheetSnapChange}
            >
                <View style={styles.sheetHeader}>
                    <Text style={styles.sheetLabel}>{t("templates.addIngredient")}</Text>
                    <View style={styles.searchRow}>
                        <Ionicons name="search" size={18} color={colors.textTertiary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t("templates.searchFoods")}
                            placeholderTextColor={colors.textTertiary}
                            value={foodQuery}
                            onChangeText={setFoodQuery}
                            onFocus={handleSearchFocus}
                        />
                        {foodQuery.length > 0 && (
                            <Pressable onPress={() => setFoodQuery("")} hitSlop={8}>
                                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                            </Pressable>
                        )}
                    </View>
                    <View style={styles.actionRow}>
                        <Button
                            title={t("log.scanBarcode")}
                            variant="outline"
                            icon={<Ionicons name="barcode-outline" size={18} color={colors.text} />}
                            onPress={() => setShowScanner(true)}
                            style={styles.actionBtn}
                        />
                        <Button
                            title={t("log.createNew")}
                            variant="outline"
                            icon={<Ionicons name="add-circle-outline" size={18} color={colors.text} />}
                            onPress={() => setShowManualForm(true)}
                            style={styles.actionBtn}
                        />
                    </View>
                </View>

                <ScrollView
                    style={styles.sheetScroll}
                    contentContainerStyle={styles.sheetScrollContent}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                >
                    {foodQuery.trim().length >= 2 && !hasSearchedOFF && !offError && (
                        <Button
                            title={isSearchingOFF ? t("templates.searching") : t("templates.searchOpenFoodFacts")}
                            onPress={handleSearchOFF}
                            variant="outline"
                            loading={isSearchingOFF}
                            style={styles.offBtn}
                        />
                    )}

                    {offError && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{offError}</Text>
                            <Button
                                title={t("common.retry")}
                                variant="ghost"
                                onPress={handleSearchOFF}
                                textStyle={{ fontSize: fontSize.sm }}
                            />
                        </View>
                    )}

                    {localResults.map((food) => (
                        <Pressable
                            key={food.id}
                            style={styles.resultRow}
                            onPress={() => handleSelectLocal(food)}
                        >
                            <Text style={styles.resultName} numberOfLines={1}>{food.name}</Text>
                            <Text style={styles.resultDetail}>
                                {t("templates.calPer100g", { cal: Math.round(food.calories_per_100g) })}
                            </Text>
                        </Pressable>
                    ))}

                    {offResults.map((p) => (
                        <Pressable
                            key={p.code}
                            style={styles.resultRow}
                            onPress={() => handleSelectOFF(p)}
                        >
                            <Text style={styles.resultName} numberOfLines={1}>
                                {p.product_name || t("common.unknown")}{" "}
                                <Ionicons name="globe-outline" size={12} color={colors.textTertiary} />
                            </Text>
                            <Text style={styles.resultDetail}>
                                {t("templates.calPer100g", { cal: Math.round(p.nutriments?.["energy-kcal_100g"] ?? 0) })}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </BottomSheet>

            <RecipeItemModal
                item={editingItem?.recipeItem ?? null}
                food={editingItem?.food ?? null}
                onClose={() => setEditingItem(null)}
                onSaved={handleModalSaved}
            />

            <ManualFoodForm
                visible={showManualForm}
                onClose={() => setShowManualForm(false)}
                onFoodCreated={handleManualFoodCreated}
                initialName={foodQuery}
            />

            <BarcodeScannerView
                visible={showScanner}
                onClose={() => setShowScanner(false)}
                onFoodFound={handleBarcodeFound}
                onNotFound={handleBarcodeNotFound}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: SHEET_COLLAPSED + spacing.lg },
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

        sheetHeader: {
            paddingHorizontal: spacing.lg,
        },
        sheetLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            marginBottom: spacing.sm,
        },
        sheetScroll: {
            flex: 1,
        },
        sheetScrollContent: {
            paddingBottom: spacing.lg,
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
            paddingHorizontal: spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        resultName: { flex: 1, fontSize: fontSize.sm, color: colors.text, marginRight: spacing.sm },
        resultDetail: { fontSize: fontSize.xs, color: colors.textSecondary },
        actionRow: {
            flexDirection: "row",
            gap: spacing.sm,
        },
        actionBtn: { flex: 1 },
        offBtn: { marginTop: spacing.sm, marginHorizontal: spacing.lg },
        errorBox: {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            justifyContent: "space-between" as const,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.sm,
            padding: spacing.sm,
            marginTop: spacing.sm,
            marginHorizontal: spacing.lg,
            borderWidth: 1,
            borderColor: colors.danger,
        },
        errorText: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.danger,
        },
        doneBtn: { marginTop: spacing.lg },
    });
}
