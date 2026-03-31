import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Stack } from "expo-router";

export default function RecipesLayout() {
    const colors = useThemeColors();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }}
        />
    );
}