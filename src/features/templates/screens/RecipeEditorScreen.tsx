import { isShareConfigured, shareRecipe } from "@/src/features/share/services/shareService";
import BarcodeScannerView from "@/src/shared/components/BarcodeScannerView";
import IconButton from "@/src/shared/atoms/IconButton";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import ShareSheet from "@/src/shared/components/ShareSheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, Keyboard, ScrollView, StyleSheet, View } from "react-native";
import AddIngredientSheet from "../components/AddIngredientSheet";
import IngredientsSectionHeader from "../components/IngredientsSectionHeader";
import CreateFoodSheet from "../components/CreateFoodSheet";
import RecipeIngredientList from "../components/RecipeIngredientList";
import RecipeItemSheet from "../components/RecipeItemSheet";
import RecipeFooter from "../components/RecipeFooter";
import RecipeMacroCard from "../components/RecipeMacroCard";
import { useRecipeEditor } from "../hooks/useRecipeEditor";

export default function RecipeEditorScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();

    const recipe = useRecipeEditor();
    const isVariant = recipe.baseName != null;

    const [shareAvailable, setShareAvailable] = useState(false);
    const [shareVisible, setShareVisible] = useState(false);

    // Re-checked on focus so signing in under Account and coming back
    // immediately enables the share button.
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            isShareConfigured().then((available) => {
                if (!cancelled) setShareAvailable(available);
            });
            return () => {
                cancelled = true;
            };
        }, []),
    );

    // Nothing is written until a save button is pressed, so leaving any other
    // way throws the work away — always ask first.
    const isDirty = recipe.isDirty;
    const handleClose = useCallback(() => {
        if (!isDirty) {
            router.back();
            return;
        }
        Alert.alert(t("templates.discardTitle"), t("templates.discardMessage"), [
            { text: t("templates.keepEditing"), style: "cancel" },
            { text: t("templates.discard"), style: "destructive", onPress: () => router.back() },
        ]);
    }, [isDirty, t]);

    // The header back button is replaced below, but Android's system back
    // still needs the same guard.
    useFocusEffect(
        useCallback(() => {
            const sub = BackHandler.addEventListener("hardwareBackPress", () => {
                handleClose();
                return true;
            });
            return () => sub.remove();
        }, [handleClose]),
    );

    const handleSharePress = useCallback(() => {
        if (!shareAvailable) {
            Alert.alert(t("share.notConfiguredTitle"), t("share.notConfiguredMessage"));
            return;
        }
        // Sharing reads the stored recipe, which is not what is on screen yet.
        if (isDirty) {
            Alert.alert(t("templates.shareUnsavedTitle"), t("templates.shareUnsavedMessage"));
            return;
        }
        setShareVisible(true);
    }, [shareAvailable, isDirty, t]);

    return (
        <View style={styles.screen}>
            {/* The navigation bar is off, and with it the back gesture that
                would skip the discard prompt. */}
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

            <ScreenHeader
                title={recipe.name.trim() || t("templates.untitled")}
                subtitle={isVariant
                    ? t("templates.variantOf", { name: recipe.baseName })
                    : t("templates.recipeEditorTitle")}
                backIcon="close"
                onBack={handleClose}
                editableTitle={{
                    value: recipe.name,
                    onChange: recipe.setName,
                    placeholder: isVariant
                        ? t("templates.variantNamePlaceholder")
                        : t("templates.recipeNamePlaceholder"),
                    label: t("templates.rename"),
                }}
                right={
                    // Only an already-saved recipe can be shared.
                    recipe.isEditing ? (
                        <IconButton
                            icon="share-outline"
                            label={t("common.share")}
                            onPress={handleSharePress}
                            color={!shareAvailable || isDirty ? colors.textTertiary : undefined}
                        />
                    ) : undefined
                }
            />

            <RecipeMacroCard
                perServing={recipe.perServing}
                totals={recipe.totals}
                servings={recipe.servings}
                onChangeServings={recipe.setServings}
                hasIngredients={recipe.canSave}
            />

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                // Scrolling away from the title is a clear sign the user is
                // done with it; nothing else takes focus off a TextInput.
                onScrollBeginDrag={Keyboard.dismiss}
            >
                <IngredientsSectionHeader count={recipe.items.length} onAdd={recipe.openSearchSheet} />
                <RecipeIngredientList items={recipe.items} onPressItem={recipe.editIngredient} />
            </ScrollView>

            <RecipeFooter
                canSave={recipe.canSave}
                onSave={recipe.handleSave}
                onSaveAndLog={recipe.handleSaveAndLog}
                onAddIngredient={recipe.openSearchSheet}
            />

            <AddIngredientSheet
                visible={recipe.showSearchSheet}
                onClose={recipe.closeSearchSheet}
                query={recipe.foodQuery}
                onChangeQuery={recipe.setFoodQuery}
                localResults={recipe.localResults}
                offResults={recipe.offResults}
                isSearchingOFF={recipe.isSearchingOFF}
                hasSearchedOFF={recipe.hasSearchedOFF}
                offError={recipe.offError}
                onSearchOFF={recipe.handleSearchOFF}
                onSelectLocal={recipe.handleSelectLocal}
                onSelectOFF={recipe.handleSelectOFF}
                onScan={recipe.openScanner}
                onCreateNew={recipe.openManualForm}
            />

            <RecipeItemSheet
                draft={recipe.editingDraft}
                isNew={recipe.isNewItem}
                onClose={recipe.closeEditing}
                onConfirm={recipe.commitEditing}
                onRemove={recipe.removeEditing}
            />

            <CreateFoodSheet
                visible={recipe.showManualForm}
                onClose={() => recipe.setShowManualForm(false)}
                onFoodCreated={recipe.handleManualFoodCreated}
                initialName={recipe.manualName ?? recipe.foodQuery}
                initialBarcode={recipe.manualBarcode}
                notice={recipe.manualNotice}
            />

            <BarcodeScannerView
                visible={recipe.showScanner}
                onClose={() => recipe.setShowScanner(false)}
                onBarcodeScanned={recipe.lookupBarcode}
                onFoodFound={recipe.handleBarcodeFound}
                onNotFound={recipe.handleBarcodeNotFound}
            />

            {recipeId && (
                <ShareSheet
                    visible={shareVisible}
                    onClose={() => setShareVisible(false)}
                    fetchUrl={() => shareRecipe(Number(recipeId))}
                />
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        list: { flex: 1 },
        // Grows to the footer, so an empty list's placeholder can centre in the free space.
        content: { flexGrow: 1, paddingHorizontal: screenPadding, paddingBottom: spacing.lg },
    });
}
