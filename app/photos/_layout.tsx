import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";


export default function PhotosLayout() {
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
            <Stack.Screen name="photos" options={{ title: t("log.photosTitle") }} />
            <Stack.Screen name="photo-details" options={{ title: t("log.photoDetailsTitle") }} />
        </Stack>
    );
}