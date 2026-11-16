import { getStreak } from "@/src/features/log/services/logDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Outline while idle, filled while active — the only state cue besides tint. */
const TAB_ICONS: Record<string, { idle: IconName; active: IconName }> = {
    index: { idle: "today-outline", active: "today" },
    templates: { idle: "library-outline", active: "library" },
    more: { idle: "ellipsis-horizontal-circle-outline", active: "ellipsis-horizontal-circle" },
};

export default function TabsLayout() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const [streak, setStreak] = useState(0);

    useFocusEffect(
        useCallback(() => {
            setStreak(getStreak());
        }, []),
    );

    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerShown: false,
                sceneStyle: { backgroundColor: colors.background },
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    elevation: 0,
                },
                tabBarActiveTintColor: colors.text,
                tabBarInactiveTintColor: colors.textTertiary,
                tabBarLabelStyle: { fontSize: fontSize.xxs, fontWeight: "600" },
                tabBarIcon: ({ color, focused }) => {
                    const icon = TAB_ICONS[route.name];
                    const glyph = <Ionicons name={focused ? icon?.active : icon?.idle} size={23} color={color} />;
                    if (route.name !== "index" || streak <= 0) return glyph;
                    return (
                        <View>
                            {glyph}
                            <View style={[styles.streakBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                                <Text style={[styles.streakText, { color: colors.onPrimary }]} numberOfLines={1}>
                                    {streak}
                                </Text>
                            </View>
                        </View>
                    );
                },
            })}
        >
            {/* The log is the home tab and sits in the middle, under the thumb. */}
            <Tabs.Screen name="templates" options={{ title: t("nav.templates") }} />
            <Tabs.Screen name="index" options={{ title: t("nav.logs") }} />
            <Tabs.Screen name="more" options={{ title: t("nav.more") }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    // The logging streak, as a small counter pinned to the Log tab's icon.
    streakBadge: {
        position: "absolute",
        top: -5,
        left: 14,
        minWidth: 17,
        height: 17,
        paddingHorizontal: 4,
        borderRadius: borderRadius.full,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
    },
    streakText: { fontSize: 9, fontWeight: "700" },
});
