import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";


export default function LogLayout() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen name="add" options={{ title: t("log.addFoodTitle") }} />
        </Stack>
    );
}
