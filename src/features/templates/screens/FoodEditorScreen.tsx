import FoodForm from "@/src/features/templates/components/FoodForm";
import { isShareConfigured, shareFood } from "@/src/features/share/services/shareService";
import ShareModal from "@/src/shared/components/ShareModal";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "expo-router/react-navigation";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from "react-native";

export default function FoodEditorScreen() {
    const { foodId } = useLocalSearchParams<{ foodId?: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const headerHeight = useHeaderHeight();

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
            keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
            style={[styles.flex, { backgroundColor: colors.background }]}
        >
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: colors.surface },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                    title: foodId
                        ? t("templates.foodEditorTitle")
                        : t("templates.newFoodTitle"),
                    // Only an already-saved food can be shared.
                    headerRight: foodId
                        ? () => (
                              <Pressable
                                  onPress={handleSharePress}
                                  hitSlop={8}
                                  style={{ opacity: shareAvailable ? 1 : 0.4 }}
                              >
                                  <Ionicons name="share-outline" size={22} color={colors.text} />
                              </Pressable>
                          )
                        : undefined,
                }}
            />
            <FoodForm
                foodId={foodId ? Number(foodId) : undefined}
                onSaved={() => router.back()}
            />
            {foodId && (
                <ShareModal
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
