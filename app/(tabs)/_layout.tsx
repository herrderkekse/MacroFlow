import { Tabs } from "expo-router";
import { Ionicons } from '@expo/vector-icons';

const icons = {
    index: 'home',
    log: 'create',
    history: 'time',
    settings: 'settings'
};

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerShown: true,
                tabBarIcon: ({ color, size }) => {
                    const name = icons[route.name as keyof typeof icons];

                    return <Ionicons name={name as any} size={size} color={color} />;
                },
            })}
        />
    );
}
