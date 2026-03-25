import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function RecipesLayout() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen name="edit" options={{ title: t("recipes.recipeEditorTitle") }} />
            <Stack.Screen name="food-edit" options={{ title: t("recipes.foodEditorTitle") }} />
        </Stack>
    );
}