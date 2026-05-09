import FoodForm from "@/src/features/templates/components/FoodForm";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

export default function FoodEditorScreen() {
    const { foodId } = useLocalSearchParams<{ foodId?: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                }}
            />
            <FoodForm
                foodId={foodId ? Number(foodId) : undefined}
                onSaved={() => router.back()}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});
