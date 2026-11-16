import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Stack } from "expo-router";

// Every screen renders the shared ScreenHeader itself, so the navigator never
// draws one.
export default function WorkoutLayout() {
    const colors = useThemeColors();
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        />
    );
}
