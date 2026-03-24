import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from "expo-router";

const icons: Record<string, string> = {
    index: 'create',
    recipes: 'book',
    settings: 'settings'
};

export default function TabsLayout() {
    const colors = useThemeColors();

    return (
        <Tabs
            screenOptions={({ route }: { route: { name: string } }) => ({
                headerShown: false,
                tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarIcon: ({ color, size }: { color: string; size: number }) => {
                    const name = icons[route.name] ?? 'help';
                    return <Ionicons name={name as any} size={size} color={color} />;
                },
            })}
        >
            <Tabs.Screen name="recipes" options={{ title: "Recipes", tabBarLabel: "Recipes" }} />
            <Tabs.Screen name="index" options={{ title: "Logs", tabBarLabel: "Logs" }} />
            <Tabs.Screen name="settings" options={{ title: "Settings", tabBarLabel: "Settings" }} />
        </Tabs>
    );
}