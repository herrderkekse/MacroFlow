import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function LogLayout() {
    const colors = useThemeColors();
    const { t } = useTranslation();
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
            <Stack.Screen name="add" options={{ title: t("log.addFoodTitle") }} />
        </Stack>
    );
}
