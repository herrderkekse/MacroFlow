import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Stack } from "expo-router";

export default function WorkoutLayout() {
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
