import { Stack } from "expo-router";
import { colors } from "@/src/utils/theme";

export default function LogLayout() {
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
