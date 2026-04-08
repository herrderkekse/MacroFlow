import FoodForm from "@/src/components/FoodForm";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

export default function FoodEditorScreen() {
    const { foodId } = useLocalSearchParams<{ foodId?: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();

    return (
        <View style={[styles.flex, { backgroundColor: colors.background }]}>
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
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});
