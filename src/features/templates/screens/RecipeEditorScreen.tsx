import { isShareConfigured, shareRecipe } from "@/src/features/share/services/shareService";
import BarcodeScannerView from "@/src/shared/components/BarcodeScannerView";
import ShareModal from "@/src/shared/components/ShareModal";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { spacing, type ThemeColors } from "@/src/utils/theme";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, Keyboard, Pressable, StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import AddIngredientSheet from "../components/AddIngredientSheet";
import IngredientsSectionHeader from "../components/IngredientsSectionHeader";
import ManualFoodForm from "../components/ManualFoodForm";
import RecipeEditorHeader from "../components/RecipeEditorHeader";
import RecipeIngredientList from "../components/RecipeIngredientList";
import RecipeItemModal from "../components/RecipeItemModal";
import RecipeMacroFooter from "../components/RecipeMacroFooter";
import RecipeServingsRow from "../components/RecipeServingsRow";
import { useRecipeEditor } from "../hooks/useRecipeEditor";

export default function RecipeEditorScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();

    const recipe = useRecipeEditor();
    const isVariant = recipe.baseName != null;

    // The servings row and the ingredients heading ride above the list rather
    // than in it. The list is padded down by their height, so the first pixels
    // of scroll slide the servings row out one-for-one — the list itself only
    // starts moving under the heading once the row is gone.
    const [servingsHeight, setServingsHeight] = useState(0);
    const [headingHeight, setHeadingHeight] = useState(0);
    const scrollY = useSharedValue(0);
    const handleScroll = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });
    const overlayStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -Math.min(scrollY.value, servingsHeight) }],
    }));

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
            {/* The screen draws its own header — the recipe title is the
                heading — so the navigation bar is off, and with it the back
                gesture that would skip the discard prompt. */}
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

            <RecipeEditorHeader
                name={recipe.name}
                onChangeName={recipe.setName}
                placeholder={
                    isVariant
                        ? t("templates.variantNamePlaceholder")
                        : t("templates.recipeNamePlaceholder")
                }
                baseName={recipe.baseName}
                // Only an already-saved recipe can be shared.
                onShare={recipe.isEditing ? handleSharePress : undefined}
                shareDimmed={!shareAvailable || isDirty}
                onClose={handleClose}
            />

            <View style={styles.listArea}>
                <Animated.ScrollView
                    contentContainerStyle={[
                        styles.content,
                        { paddingTop: servingsHeight + headingHeight },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    // Scrolling away from the title is a clear sign the user is
                    // done with it; nothing else takes focus off a TextInput.
                    onScrollBeginDrag={Keyboard.dismiss}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >
                    <RecipeIngredientList
                        items={recipe.items}
                        onPressItem={recipe.editIngredient}
                        onAdd={recipe.openSearchSheet}
                    />
                </Animated.ScrollView>

                {/* Clipped by listArea, so the servings row is gone the moment
                    it has travelled its own height. */}
                <Animated.View style={[styles.overlay, overlayStyle]}>
                    <Pressable onPress={Keyboard.dismiss} accessible={false}>
                        <RecipeServingsRow
                            servings={recipe.servings}
                            onChangeServings={recipe.setServings}
                            onLayout={(e) => setServingsHeight(e.nativeEvent.layout.height)}
                        />
                        <IngredientsSectionHeader
                            count={recipe.items.length}
                            onAdd={recipe.openSearchSheet}
                            onLayout={(e) => setHeadingHeight(e.nativeEvent.layout.height)}
                        />
                    </Pressable>
                </Animated.View>
            </View>

            <RecipeMacroFooter
                perServing={recipe.perServing}
                totals={recipe.totals}
                servings={recipe.servings}
                canSave={recipe.canSave}
                onSave={recipe.handleSave}
                onSaveAndLog={recipe.handleSaveAndLog}
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

            <RecipeItemModal
                draft={recipe.editingDraft}
                isNew={recipe.isNewItem}
                onClose={recipe.closeEditing}
                onConfirm={recipe.commitEditing}
                onRemove={recipe.removeEditing}
            />

            <ManualFoodForm
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
                <ShareModal
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
        listArea: { flex: 1, overflow: "hidden" },
        overlay: { position: "absolute", top: 0, left: 0, right: 0 },
        content: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
    });
}
