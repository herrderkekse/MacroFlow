import { isShareConfigured, shareFood } from "@/src/features/share/services/shareService";
import FoodForm from "@/src/features/templates/components/FoodForm";
import IconButton from "@/src/shared/atoms/IconButton";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import ShareSheet from "@/src/shared/components/ShareSheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";

export default function FoodEditorScreen() {
    const { foodId } = useLocalSearchParams<{ foodId?: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();

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

    function handleSharePress() {
        if (!shareAvailable) {
            Alert.alert(t("share.notConfiguredTitle"), t("share.notConfiguredMessage"));
            return;
        }
        setShareVisible(true);
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.flex, { backgroundColor: colors.background }]}
        >
            <ScreenHeader
                title={foodId ? t("templates.foodEditorTitle") : t("templates.newFoodTitle")}
                right={
                    // Only an already-saved food can be shared.
                    foodId ? (
                        <IconButton
                            icon="share-outline"
                            label={t("common.share")}
                            onPress={handleSharePress}
                            color={shareAvailable ? undefined : colors.textTertiary}
                        />
                    ) : undefined
                }
            />
            <FoodForm
                foodId={foodId ? Number(foodId) : undefined}
                onSaved={() => router.back()}
            />
            {foodId && (
                <ShareSheet
                    visible={shareVisible}
                    onClose={() => setShareVisible(false)}
                    fetchUrl={() => shareFood(Number(foodId))}
                />
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});
