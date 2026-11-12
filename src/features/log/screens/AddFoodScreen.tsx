import { isObsolete, productName, productNutrition } from "@/src/services/openfoodfacts";
import Button from "@/src/shared/atoms/Button";
import Chip from "@/src/shared/atoms/Chip";
import EmptyState from "@/src/shared/atoms/EmptyState";
import IconButton from "@/src/shared/atoms/IconButton";
import Notice from "@/src/shared/atoms/Notice";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import BarcodeScannerView from "@/src/shared/components/BarcodeScannerView";
import ChipRow from "@/src/shared/components/ChipRow";
import FoodRow from "@/src/shared/components/FoodRow";
import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SearchBar from "@/src/shared/components/SearchBar";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import type { MealType } from "@/src/shared/types";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import EntrySheet from "../components/EntrySheet";
import CreateFoodSheet from "../components/CreateFoodSheet";
import RecipeLogSheet from "../components/RecipeLogSheet";
import { useAddFoodSearch } from "../hooks/useAddFoodSearch";

export default function AddFoodScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { mealType, recipeId } = useLocalSearchParams<{ mealType?: string; recipeId?: string }>();

    const search = useAddFoodSearch();

    const mealLabel = mealType ? t(`meal.${mealType}`) : undefined;

    function openQuickAdd() {
        const target = mealType ? `/log/quick-add?mealType=${mealType}` : "/log/quick-add";
        router.push(target as unknown as Href);
    }

    return (
        <View style={styles.screen}>
            <ScreenHeader title={t("log.addFoodTitle")} subtitle={mealLabel}>
                <SearchBar
                    value={search.query}
                    onChangeText={search.setQuery}
                    placeholder={t("log.searchPlaceholder")}
                    autoFocus={!recipeId}
                />
                <ChipRow scroll bleed={screenPadding} style={styles.actionRow}>
                    <Chip label={t("log.scanBarcode")} icon="barcode-outline" onPress={() => search.setShowScanner(true)} />
                    <Chip label={t("log.createNew")} icon="create-outline" onPress={search.openManualForm} />
                    <Chip label={t("log.quickAdd")} icon="flash-outline" onPress={openQuickAdd} />
                </ChipRow>
            </ScreenHeader>

            <ScrollView
                contentContainerStyle={styles.results}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {search.showLocalSection && search.recipeResults.length > 0 && (
                    <>
                        <SectionLabel style={styles.firstLabel}>{t("log.sectionRecipes")}</SectionLabel>
                        <ListGroup>
                            {search.recipeResults.map((group) => {
                                const expanded = search.expandedRecipeIds.has(group.recipe.id);
                                return (
                                    <View key={group.recipe.id}>
                                        <ListRow
                                            icon="book-outline"
                                            title={group.recipe.name}
                                            subtitle={
                                                group.variants.length > 0
                                                    ? t("templates.variantCount", { count: group.variants.length })
                                                    : undefined
                                            }
                                            onPress={() => search.setSelectedRecipe(group.recipe)}
                                            right={
                                                group.variants.length > 0 ? (
                                                    <IconButton
                                                        icon={expanded ? "chevron-up" : "chevron-down"}
                                                        size="sm"
                                                        label={t("templates.showVariants")}
                                                        onPress={() => search.toggleRecipeExpanded(group.recipe.id)}
                                                    />
                                                ) : undefined
                                            }
                                        />
                                        {expanded && group.variants.map((variant) => (
                                            <ListRow
                                                key={variant.id}
                                                icon="return-down-forward-outline"
                                                title={variant.name}
                                                onPress={() => search.setSelectedRecipe(variant)}
                                            />
                                        ))}
                                    </View>
                                );
                            })}
                        </ListGroup>
                    </>
                )}

                {search.showLocalSection && (
                    <>
                        <SectionLabel style={search.recipeResults.length === 0 ? styles.firstLabel : undefined}>
                            {t("log.sectionOnDevice")}
                        </SectionLabel>
                        {search.localResults.length === 0 ? (
                            <Text style={styles.emptyText}>{t("log.noLocalResults")}</Text>
                        ) : (
                            <ListGroup>
                                {search.localResults.map((food) => (
                                    <FoodRow
                                        key={food.id}
                                        name={food.name}
                                        nutrition={{
                                            calories: food.calories_per_100g,
                                            protein: food.protein_per_100g,
                                            carbs: food.carbs_per_100g,
                                            fat: food.fat_per_100g,
                                        }}
                                        onPress={() => search.handleSelectLocal(food)}
                                    />
                                ))}
                            </ListGroup>
                        )}

                        <SectionLabel>{t("log.sectionOpenFoodFacts")}</SectionLabel>

                        {!search.hasSearchedOFF && !search.isSearchingOFF && (
                            <Button
                                title={t("log.searchOnline")}
                                variant="outline"
                                icon={<Ionicons name="globe-outline" size={17} color={colors.text} />}
                                onPress={search.handleSearchOFF}
                            />
                        )}

                        {search.isSearchingOFF && (
                            <ActivityIndicator color={colors.textSecondary} style={styles.spinner} />
                        )}

                        {search.offError && (
                            <Notice
                                tone="danger"
                                style={styles.error}
                                action={<Button title={t("common.retry")} variant="ghost" size="sm" onPress={search.handleSearchOFF} />}
                            >
                                {search.offError}
                            </Notice>
                        )}

                        {search.hasSearchedOFF && search.offResults.length === 0 && !search.offError && (
                            <Text style={styles.emptyText}>{t("common.noOnlineResults")}</Text>
                        )}

                        {search.offResults.length > 0 && (
                            <ListGroup>
                                {search.offResults.map((p) => {
                                    // The search index carries only the as-sold per-100 g
                                    // figures, so this preview can fall short of what the
                                    // import ends up with once the product is hydrated.
                                    const nutrition = productNutrition(p);
                                    return (
                                        <FoodRow
                                            key={p.code}
                                            name={productName(p, t("common.unknown"))}
                                            nutrition={
                                                nutrition && {
                                                    calories: nutrition.calories_per_100g,
                                                    protein: nutrition.protein_per_100g,
                                                    carbs: nutrition.carbs_per_100g,
                                                    fat: nutrition.fat_per_100g,
                                                }
                                            }
                                            warning={isObsolete(p) ? t("common.offObsolete") : undefined}
                                            isOnline
                                            onPress={() => search.handleSelectOFF(p)}
                                        />
                                    );
                                })}
                            </ListGroup>
                        )}
                    </>
                )}

                {!search.showLocalSection && (
                    <EmptyState icon="search-outline" title={t("log.searchPrompt")} style={styles.placeholder} />
                )}
            </ScrollView>

            {/* Modals */}
            <CreateFoodSheet
                visible={search.showManualForm}
                onClose={search.handleCloseManualForm}
                onFoodCreated={search.handleFoodCreated}
                initialName={search.manualName}
                initialBarcode={search.manualBarcode}
                notice={search.manualNotice}
            />

            <BarcodeScannerView
                visible={search.showScanner}
                onClose={() => search.setShowScanner(false)}
                onBarcodeScanned={search.lookupBarcode}
                onFoodFound={search.handleBarcodeFound}
                onNotFound={search.handleBarcodeNotFound}
            />

            <EntrySheet
                food={search.selectedFood}
                defaultMealType={mealType as MealType | undefined}
                onClose={() => search.setSelectedFood(null)}
                onSaved={search.handleEntrySaved}
            />

            <RecipeLogSheet
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
        // Bleeds to the screen edge so the chips scroll under it.
        actionRow: { marginTop: spacing.sm + 4 },
        results: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl },
        firstLabel: { marginTop: spacing.sm },
        emptyText: { fontSize: fontSize.sm, color: colors.textTertiary, paddingVertical: spacing.sm },
        spinner: { marginVertical: spacing.md },
        error: { marginTop: spacing.sm },
        placeholder: { marginTop: spacing.xl },
    });
}
