import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RecipesLayout() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                headerStatusBarHeight: insets.top,
            }}
        >
            <Stack.Screen
                name="edit"
                options={({ route }) => ({
                    title: (route.params as { recipeId?: string })?.recipeId
                        ? t("recipes.recipeEditorTitle")
                        : t("recipes.newRecipeTitle"),
                })}
            />
            <Stack.Screen
                name="food-edit"
                options={({ route }) => ({
                    title: (route.params as { foodId?: string })?.foodId
                        ? t("recipes.foodEditorTitle")
                        : t("recipes.newFoodTitle"),
                })}
            />
        </Stack>
    );
}