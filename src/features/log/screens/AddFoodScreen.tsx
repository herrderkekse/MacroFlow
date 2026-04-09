import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import type { MealType } from "@/src/shared/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BarcodeScannerView from "@/src/shared/components/BarcodeScannerView";
import EntryModal from "../components/EntryModal";
import FoodListItem from "../components/FoodListItem";
import ManualFoodForm from "../components/ManualFoodForm";
import RecipeLogModal from "../components/RecipeLogModal";
import { useAddFoodSearch } from "../hooks/useAddFoodSearch";

export default function AddFoodScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const { mealType } = useLocalSearchParams<{ mealType?: string }>();

    const search = useAddFoodSearch();

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            {/* Search bar */}
            <View style={styles.searchRow}>
                <Ionicons name="search" size={20} color={colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t("log.searchPlaceholder")}
                    placeholderTextColor={colors.textTertiary}
                    value={search.query}
                    onChangeText={search.setQuery}
                    autoFocus
                    returnKeyType="search"
                />
                {search.query.length > 0 && (
                    <Pressable onPress={() => search.setQuery("")} hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                    </Pressable>
                )}
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
                <Button
                    title={t("log.scanBarcode")}
                    variant="outline"
                    icon={<Ionicons name="barcode-outline" size={18} color={colors.text} />}
                    onPress={() => search.setShowScanner(true)}
                    style={styles.actionButton}
                />
                <Button
                    title={t("log.createNew")}
                    variant="outline"
                    icon={<Ionicons name="create-outline" size={18} color={colors.text} />}
                    onPress={() => search.setShowManualForm(true)}
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
                {search.showLocalSection && search.recipeResults.length > 0 && (
                    <>
                        <Text style={styles.sectionLabel}>{t("log.sectionRecipes")}</Text>
                        {search.recipeResults.map((r) => (
                            <Pressable
                                key={r.id}
                                style={styles.recipeRow}
                                onPress={() => search.setSelectedRecipe(r)}
                            >
                                <Ionicons name="book-outline" size={18} color={colors.primary} />
                                <Text style={styles.recipeRowName} numberOfLines={1}>{r.name}</Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                            </Pressable>
                        ))}
                    </>
                )}

                {/* Local results */}
                {search.showLocalSection && (
                    <>
                        <Text style={styles.sectionLabel}>{t("log.sectionOnDevice")}</Text>
                        {search.localResults.length === 0 ? (
                            <Text style={styles.emptyText}>{t("log.noLocalResults")}</Text>
                        ) : (
                            search.localResults.map((food) => (
                                <FoodListItem
                                    key={food.id}
                                    name={food.name}
                                    calories={food.calories_per_100g}
                                    protein={food.protein_per_100g}
                                    carbs={food.carbs_per_100g}
                                    fat={food.fat_per_100g}
                                    onPress={() => search.handleSelectLocal(food)}
                                />
                            ))
                        )}
                    </>
                )}

                {/* OpenFoodFacts section */}
                {search.showLocalSection && (
                    <>
                        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                            {t("log.sectionOpenFoodFacts")}
                        </Text>

                        {!search.hasSearchedOFF && !search.isSearchingOFF && (
                            <Button
                                title={t("log.searchOnline")}
                                variant="secondary"
                                icon={<Ionicons name="globe-outline" size={16} color={colors.primary} />}
                                onPress={search.handleSearchOFF}
                                style={{ marginBottom: spacing.sm }}
                            />
                        )}

                        {search.isSearchingOFF && (
                            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
                        )}

                        {search.offError && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{search.offError}</Text>
                                <Button
                                    title={t("common.retry")}
                                    variant="ghost"
                                    onPress={search.handleSearchOFF}
                                    textStyle={{ fontSize: fontSize.sm }}
                                />
                            </View>
                        )}

                        {search.hasSearchedOFF && search.offResults.length === 0 && !search.offError && (
                            <Text style={styles.emptyText}>{t("common.noOnlineResults")}</Text>
                        )}

                        {search.offResults.map((p) => (
                            <FoodListItem
                                key={p.code}
                                name={p.product_name ?? t("common.unknown")}
                                calories={p.nutriments?.["energy-kcal_100g"] ?? 0}
                                protein={p.nutriments?.proteins_100g ?? 0}
                                carbs={p.nutriments?.carbohydrates_100g ?? 0}
                                fat={p.nutriments?.fat_100g ?? 0}
                                badge="OFF"
                                onPress={() => search.handleSelectOFF(p)}
                            />
                        ))}
                    </>
                )}

                {!search.showLocalSection && (
                    <View style={styles.placeholder}>
                        <Ionicons name="search-outline" size={48} color={colors.border} />
                        <Text style={styles.placeholderText}>{t("log.searchPrompt")}</Text>
                    </View>
                )}
            </ScrollView>

            {/* Modals */}
            <ManualFoodForm
                visible={search.showManualForm}
                onClose={() => search.setShowManualForm(false)}
                onFoodCreated={search.handleFoodCreated}
                initialName={search.query.trim()}
            />

            <BarcodeScannerView
                visible={search.showScanner}
                onClose={() => search.setShowScanner(false)}
                onBarcodeScanned={search.lookupBarcode}
                onFoodFound={search.handleBarcodeFound}
                onNotFound={search.handleBarcodeNotFound}
            />

            <EntryModal
                food={search.selectedFood}
                defaultMealType={mealType as MealType | undefined}
                onClose={() => search.setSelectedFood(null)}
                onSaved={search.handleEntrySaved}
            />

            <RecipeLogModal
                recipe={search.selectedRecipe}
                defaultMealType={mealType as MealType | undefined}
                onClose={() => search.setSelectedRecipe(null)}
                onSaved={() => {
                    search.setSelectedRecipe(null);
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
