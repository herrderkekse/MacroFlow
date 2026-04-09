import BarcodeScannerView from "@/src/shared/components/BarcodeScannerView";
import ManualFoodForm from "../components/ManualFoodForm";
import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import BottomSheet, { type BottomSheetRef } from "@/src/shared/components/BottomSheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { fromGrams, unitLabel, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React, { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import RecipeItemModal from "../components/RecipeItemModal";
import { useRecipeEditor } from "../hooks/useRecipeEditor";

const SHEET_COLLAPSED = 160;

export default function RecipeEditorScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { height: screenHeight } = useWindowDimensions();
    const sheetRef = useRef<BottomSheetRef>(null);
    const snapPoints = useMemo(() => [SHEET_COLLAPSED, Math.round(screenHeight * 0.8)], [screenHeight]);

    const recipe = useRecipeEditor();

    const handleSearchFocus = useCallback(() => {
        sheetRef.current?.snapTo(1);
    }, []);

    const handleSheetSnapChange = useCallback((index: number) => {
        if (index === 0) Keyboard.dismiss();
    }, []);

    // Wrap addItemForFood calls that need to collapse sheet
    const handleSelectLocal = useCallback((food: Parameters<typeof recipe.handleSelectLocal>[0]) => {
        sheetRef.current?.snapTo(0);
        recipe.handleSelectLocal(food);
    }, [recipe]);

    const handleSelectOFF = useCallback((product: Parameters<typeof recipe.handleSelectOFF>[0]) => {
        sheetRef.current?.snapTo(0);
        recipe.handleSelectOFF(product);
    }, [recipe]);

    return (
        <View style={styles.screen}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: colors.surface },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                    title: recipe.isEditing
                        ? t("templates.recipeEditorTitle")
                        : t("templates.newRecipeTitle"),
                }}
            />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <Input
                    label={t("templates.recipeName")}
                    placeholder={t("templates.recipeNamePlaceholder")}
                    value={recipe.name}
                    onChangeText={recipe.setName}
                    containerStyle={styles.nameInput}
                />

                <Text style={styles.summary}>
                    {t("common.itemCount", { count: recipe.items.length })} · {Math.round(recipe.totalCals)} {t("common.cal")}
                </Text>

                {recipe.items.slice().reverse().map((itemWithFood) => {
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
                                onPress={() => recipe.setEditingItem(itemWithFood)}
                            >
                                <Text style={styles.itemName} numberOfLines={1}>
                                    {food?.name ?? t("common.unknown")}
                                </Text>
                                <Text style={styles.itemDetail}>
                                    {displayQty} {displayUnit} · {cals} {t("common.cal")}
                                </Text>
                            </Pressable>
                            <Pressable onPress={() => recipe.handleDeleteItem(recipeItem.id)} hitSlop={8}>
                                <Ionicons name="close-circle-outline" size={20} color={colors.textTertiary} />
                            </Pressable>
                        </View>
                    );
                })}

                <Button title={t("common.done")} onPress={recipe.handleDone} style={styles.doneBtn} />
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
                            value={recipe.foodQuery}
                            onChangeText={recipe.setFoodQuery}
                            onFocus={handleSearchFocus}
                        />
                        {recipe.foodQuery.length > 0 && (
                            <Pressable onPress={() => recipe.setFoodQuery("")} hitSlop={8}>
                                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                            </Pressable>
                        )}
                    </View>
                    <View style={styles.actionRow}>
                        <Button
                            title={t("log.scanBarcode")}
                            variant="outline"
                            icon={<Ionicons name="barcode-outline" size={18} color={colors.text} />}
                            onPress={() => recipe.setShowScanner(true)}
                            style={styles.actionBtn}
                        />
                        <Button
                            title={t("log.createNew")}
                            variant="outline"
                            icon={<Ionicons name="add-circle-outline" size={18} color={colors.text} />}
                            onPress={() => recipe.setShowManualForm(true)}
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
                    {recipe.foodQuery.trim().length >= 2 && !recipe.hasSearchedOFF && !recipe.offError && (
                        <Button
                            title={recipe.isSearchingOFF ? t("templates.searching") : t("templates.searchOpenFoodFacts")}
                            onPress={recipe.handleSearchOFF}
                            variant="outline"
                            loading={recipe.isSearchingOFF}
                            style={styles.offBtn}
                        />
                    )}

                    {recipe.offError && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{recipe.offError}</Text>
                            <Button
                                title={t("common.retry")}
                                variant="ghost"
                                onPress={recipe.handleSearchOFF}
                                textStyle={{ fontSize: fontSize.sm }}
                            />
                        </View>
                    )}

                    {recipe.localResults.map((food) => (
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

                    {recipe.offResults.map((p) => (
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
                item={recipe.editingItem?.recipeItem ?? null}
                food={recipe.editingItem?.food ?? null}
                onClose={() => recipe.setEditingItem(null)}
                onSaved={recipe.handleModalSaved}
            />

            <ManualFoodForm
                visible={recipe.showManualForm}
                onClose={() => recipe.setShowManualForm(false)}
                onFoodCreated={recipe.handleManualFoodCreated}
                initialName={recipe.foodQuery}
            />

            <BarcodeScannerView
                visible={recipe.showScanner}
                onClose={() => recipe.setShowScanner(false)}
                onBarcodeScanned={recipe.lookupBarcode}
                onFoodFound={recipe.handleBarcodeFound}
                onNotFound={recipe.handleBarcodeNotFound}
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
        sheetHeader: { paddingHorizontal: spacing.lg },
        sheetLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            marginBottom: spacing.sm,
        },
        sheetScroll: { flex: 1 },
        sheetScrollContent: { paddingBottom: spacing.lg },
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
        actionRow: { flexDirection: "row", gap: spacing.sm },
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
