import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from "expo-router";

const icons = {
    index: 'home',
    log: 'create',
    recipes: 'book',
    history: 'time',
    settings: 'settings'
};

export default function TabsLayout() {
    const colors = useThemeColors();
    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerShown: true,
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarIcon: ({ color, size }) => {
                    const name = icons[route.name as keyof typeof icons];

                    return <Ionicons name={name as any} size={size} color={color} />;
                },
            })}
        />
    );
}
