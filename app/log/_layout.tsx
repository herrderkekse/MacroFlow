import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Stack } from "expo-router";

export default function LogLayout() {
    const colors = useThemeColors();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen name="add" options={{ title: "Add Food" }} />
        </Stack>
    );
}
