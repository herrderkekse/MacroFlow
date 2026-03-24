import Button from "@/src/components/Button";
import {
    addFood,
    getFoodByOpenfoodfactsId,
    searchFoodsByName,
    searchRecipesByName,
    type Food,
    type Recipe,
} from "@/src/db/queries";
import {
    guessUnit,
    parseServingSize,
    searchProducts,
    type OFFProduct,
} from "@/src/services/openfoodfacts";
import type { MealType } from "@/src/types";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BarcodeScannerView from "./BarcodeScannerView";
import EntryModal from "./EntryModal";
import FoodListItem from "./FoodListItem";
import ManualFoodForm from "./ManualFoodForm";
import RecipeLogModal from "./RecipeLogModal";

export default function AddFoodScreen() {
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const { mealType } = useLocalSearchParams<{ mealType?: string }>();

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

    // ── Recipe search ──────────────────────────────────────
    const [recipeResults, setRecipeResults] = useState<Recipe[]>([]);

    useEffect(() => {
        if (query.trim().length < 2) { setRecipeResults([]); return; }
        const t = setTimeout(() => setRecipeResults(searchRecipesByName(query.trim())), 200);
        return () => clearTimeout(t);
    }, [query]);

    // ── Local search (debounced, search-as-you-type) ──────
    useEffect(() => {
        if (query.trim().length < 2) {
            setLocalResults([]);
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
        setOffResults([]);
        setOffError(null);
        setHasSearchedOFF(false);
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
            logger.info("[API] OFF search returned", {
                count: results.length,
            });
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Search failed";
            setOffError(msg);
        } finally {
            setIsSearchingOFF(false);
        }
    }, [query]);

    // ── Handlers ───────────────────────────────────────────

    function handleSelectLocal(food: Food) {
        Keyboard.dismiss();
        setSelectedFood(food);
    }

    function handleSelectOFF(product: OFFProduct) {
        Keyboard.dismiss();
        // Reuse existing local copy if present
        const existing = getFoodByOpenfoodfactsId(product.code);
        if (existing) {
            setSelectedFood(existing);
            return;
        }
        // Create local copy
        const food = addFood({
            name: product.product_name ?? "Unknown",
            calories_per_100g:
                product.nutriments?.["energy-kcal_100g"] ?? 0,
            protein_per_100g: product.nutriments?.proteins_100g ?? 0,
            carbs_per_100g: product.nutriments?.carbohydrates_100g ?? 0,
            fat_per_100g: product.nutriments?.fat_100g ?? 0,
            openfoodfacts_id: product.code,
            source: "openfoodfacts",
            default_unit: guessUnit(product),
            serving_size: parseServingSize(product),
        });
        logger.info("[DB] Created food from OFF search", {
            id: food.id,
            name: food.name,
        });
        setSelectedFood(food);
    }

    function handleFoodCreated(food: Food) {
        setShowManualForm(false);
        setTimeout(() => setSelectedFood(food), 300);
    }

    function handleBarcodeFound(food: Food) {
        setShowScanner(false);
        setTimeout(() => setSelectedFood(food), 300);
    }

    function handleBarcodeNotFound() {
        setShowScanner(false);
        setTimeout(() => setShowManualForm(true), 300);
    }

    function handleEntrySaved() {
        setSelectedFood(null);
        router.back();
    }

    // ── Filter OFF results already in local DB ─────────────
    const localOffIds = new Set(
        localResults
            .map((f) => f.openfoodfacts_id)
            .filter(Boolean),
    );
    const filteredOFF = offResults.filter(
        (p) => !localOffIds.has(p.code),
    );

    const showLocalSection = query.trim().length >= 2;

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            {/* Search bar */}
            <View style={styles.searchRow}>
                <Ionicons
                    name="search"
                    size={20}
                    color={colors.textTertiary}
                />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search foods…"
                    placeholderTextColor={colors.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                    returnKeyType="search"
                />
                {query.length > 0 && (
                    <Pressable onPress={() => setQuery("")} hitSlop={8}>
                        <Ionicons
                            name="close-circle"
                            size={20}
                            color={colors.textTertiary}
                        />
                    </Pressable>
                )}
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
                <Button
                    title="Scan Barcode"
                    variant="outline"
                    icon={
                        <Ionicons
                            name="barcode-outline"
                            size={18}
                            color={colors.text}
                        />
                    }
                    onPress={() => setShowScanner(true)}
                    style={styles.actionButton}
                />
                <Button
                    title="Create New"
                    variant="outline"
                    icon={
                        <Ionicons
                            name="create-outline"
                            size={18}
                            color={colors.text}
                        />
                    }
                    onPress={() => setShowManualForm(true)}
                    style={styles.actionButton}
                />
            </View>

            {/* Results */}
            <ScrollView
                contentContainerStyle={styles.results}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Recipe results */}
                {showLocalSection && recipeResults.length > 0 && (
                    <>
                        <Text style={styles.sectionLabel}>RECIPES</Text>
                        {recipeResults.map((r) => (
                            <Pressable
                                key={r.id}
                                style={styles.recipeRow}
                                onPress={() => setSelectedRecipe(r)}
                            >
                                <Ionicons name="book-outline" size={18} color={colors.primary} />
                                <Text style={styles.recipeRowName} numberOfLines={1}>{r.name}</Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                            </Pressable>
                        ))}
                    </>
                )}

                {/* Local results */}
                {showLocalSection && (
                    <>
                        <Text style={styles.sectionLabel}>
                            ON YOUR DEVICE
                        </Text>
                        {localResults.length === 0 ? (
                            <Text style={styles.emptyText}>
                                No local results
                            </Text>
                        ) : (
                            localResults.map((food) => (
                                <FoodListItem
                                    key={food.id}
                                    name={food.name}
                                    calories={food.calories_per_100g}
                                    protein={food.protein_per_100g}
                                    carbs={food.carbs_per_100g}
                                    fat={food.fat_per_100g}
                                    onPress={() => handleSelectLocal(food)}
                                />
                            ))
                        )}
                    </>
                )}

                {/* OpenFoodFacts section */}
                {showLocalSection && (
                    <>
                        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                            OPENFOODFACTS
                        </Text>

                        {!hasSearchedOFF && !isSearchingOFF && (
                            <Button
                                title="Search Online"
                                variant="secondary"
                                icon={
                                    <Ionicons
                                        name="globe-outline"
                                        size={16}
                                        color={colors.primary}
                                    />
                                }
                                onPress={handleSearchOFF}
                                style={{ marginBottom: spacing.sm }}
                            />
                        )}

                        {isSearchingOFF && (
                            <ActivityIndicator
                                color={colors.primary}
                                style={{ marginVertical: spacing.md }}
                            />
                        )}

                        {offError && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>
                                    {offError}
                                </Text>
                                <Button
                                    title="Retry"
                                    variant="ghost"
                                    onPress={handleSearchOFF}
                                    textStyle={{ fontSize: fontSize.sm }}
                                />
                            </View>
                        )}

                        {hasSearchedOFF && filteredOFF.length === 0 && !offError && (
                            <Text style={styles.emptyText}>
                                No online results
                            </Text>
                        )}

                        {filteredOFF.map((p) => (
                            <FoodListItem
                                key={p.code}
                                name={p.product_name ?? "Unknown"}
                                calories={
                                    p.nutriments?.["energy-kcal_100g"] ?? 0
                                }
                                protein={
                                    p.nutriments?.proteins_100g ?? 0
                                }
                                carbs={
                                    p.nutriments?.carbohydrates_100g ?? 0
                                }
                                fat={p.nutriments?.fat_100g ?? 0}
                                badge="OFF"
                                onPress={() => handleSelectOFF(p)}
                            />
                        ))}
                    </>
                )}

                {!showLocalSection && (
                    <View style={styles.placeholder}>
                        <Ionicons
                            name="search-outline"
                            size={48}
                            color={colors.border}
                        />
                        <Text style={styles.placeholderText}>
                            Search for a food, scan a barcode, or create a
                            new one
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Modals */}
            <ManualFoodForm
                visible={showManualForm}
                onClose={() => setShowManualForm(false)}
                onFoodCreated={handleFoodCreated}
            />

            <BarcodeScannerView
                visible={showScanner}
                onClose={() => setShowScanner(false)}
                onFoodFound={handleBarcodeFound}
                onNotFound={handleBarcodeNotFound}
            />

            <EntryModal
                food={selectedFood}
                defaultMealType={mealType as MealType | undefined}
                onClose={() => setSelectedFood(null)}
                onSaved={handleEntrySaved}
            />

            <RecipeLogModal
                recipe={selectedRecipe}
                defaultMealType={mealType as MealType | undefined}
                onClose={() => setSelectedRecipe(null)}
                onSaved={() => {
                    setSelectedRecipe(null);
                    router.back();
                }}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        searchRow: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            marginHorizontal: spacing.md,
            marginTop: spacing.md,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.sm,
        },
        searchInput: {
            flex: 1,
            paddingVertical: spacing.sm + 2,
            fontSize: fontSize.md,
            color: colors.text,
        },
        actionRow: {
            flexDirection: "row",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            marginTop: spacing.md,
        },
        actionButton: { flex: 1 },
        results: { padding: spacing.md, paddingBottom: 40 },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "700",
            color: colors.textTertiary,
            letterSpacing: 1,
            marginBottom: spacing.sm,
        },
        emptyText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            fontStyle: "italic",
            marginBottom: spacing.md,
        },
        errorBox: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.sm,
            padding: spacing.sm,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: colors.danger,
        },
        errorText: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.danger,
        },
        placeholder: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 80,
        },
        placeholderText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            textAlign: "center",
            marginTop: spacing.md,
            maxWidth: 220,
        },
        recipeRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
        },
        recipeRowName: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.text,
        },
    });
}
