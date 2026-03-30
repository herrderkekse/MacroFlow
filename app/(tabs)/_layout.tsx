import { getStreak } from "@/src/db/queries";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

const icons: Record<string, string> = {
    index: 'create',
    templates: 'library',
    more: 'ellipsis-horizontal'
};

export default function TabsLayout() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const [streak, setStreak] = useState(0);

    const styles = StyleSheet.create({
        iconContainer: {
            position: 'relative',
        },
        streakBadge: {
            position: 'absolute',
            top: -4,
            right: -18,
            flexDirection: 'row',
            alignItems: 'center',
        },
        streakText: {
            fontSize: streak >= 1000 ? 9 : streak >= 100 ? 11 : 13,
            fontWeight: '700',
            color: colors.textSecondary,
        },
    });

    useFocusEffect(
        useCallback(() => {
            setStreak(getStreak());
        }, [])
    );

    return (
        <Tabs
            screenOptions={({ route }: { route: { name: string } }) => ({
                headerShown: false,
                tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarIcon: ({ color, size }: { color: string; size: number }) => {
                    const name = icons[route.name] ?? 'help';
                    if (route.name === 'index' && streak > 0) {
                        return (
                            <View style={styles.iconContainer}>
                                <Ionicons name={name as any} size={size} color={color} />
                                <View style={styles.streakBadge}>
                                    <Text style={styles.streakText} numberOfLines={1}>{`🔥${streak}`}</Text>
                                </View>
                            </View>
                        );
                    }
                    return <Ionicons name={name as any} size={size} color={color} />;
                },
            })}
        >
            <Tabs.Screen name="templates" options={{ title: t("nav.templates"), tabBarLabel: t("nav.templates") }} />
            <Tabs.Screen name="index" options={{ title: t("nav.logs"), tabBarLabel: t("nav.logs") }} />
            <Tabs.Screen name="more" options={{ title: t("nav.more"), tabBarLabel: t("nav.more") }} />
            {/* Hidden screens — part of tabs so the tab bar stays visible */}
            <Tabs.Screen name="analytics" options={{ href: null }} />
            <Tabs.Screen name="goals" options={{ href: null }} />
            <Tabs.Screen name="backup" options={{ href: null }} />
            <Tabs.Screen name="settings" options={{ href: null }} />
        </Tabs>
    );
}
