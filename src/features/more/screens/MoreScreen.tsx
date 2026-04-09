import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MenuItem = {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    labelKey: string;
    route: string;
    color: string;
};

export default function MoreScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const menuItems: MenuItem[] = [
        { icon: "bar-chart", labelKey: "more.analytics", route: "/(tabs)/analytics", color: "#6C63FF" },
        { icon: "flag", labelKey: "more.goals", route: "/(tabs)/goals", color: "#FF6B6B" },
        { icon: "archive", labelKey: "more.backup", route: "/(tabs)/backup", color: "#4ECDC4" },
        { icon: "sparkles", labelKey: "more.mealPlan", route: "/(tabs)/meal-plan", color: "#A855F7" },
        { icon: "hardware-chip", labelKey: "more.aiSettings", route: "/(tabs)/ai-settings", color: "#F59E0B" },
    ];

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.heading}>{t("nav.more")}</Text>

                <View style={styles.menuCard}>
                    {menuItems.map((item, index) => (
                        <React.Fragment key={item.route}>
                            <Pressable
                                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                                onPress={() => router.push(item.route as unknown as Href)}
                            >
                                <View style={[styles.iconWrapper, { backgroundColor: item.color + "20" }]}>
                                    <Ionicons name={item.icon} size={22} color={item.color} />
                                </View>
                                <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                            </Pressable>
                            {index < menuItems.length - 1 && <View style={styles.divider} />}
                        </React.Fragment>
                    ))}
                </View>
            </ScrollView>

            {/* Settings gear FAB */}
            <Pressable
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                onPress={() => router.push("/(tabs)/settings" as unknown as Href)}
            >
                <Ionicons name="settings-sharp" size={26} color="#fff" />
            </Pressable>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: 100 },
        heading: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.lg,
        },
        menuCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
        },
        menuRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md + 2,
            gap: spacing.md,
        },
        menuRowPressed: { opacity: 0.6 },
        iconWrapper: {
            width: 40,
            height: 40,
            borderRadius: borderRadius.md,
            alignItems: "center",
            justifyContent: "center",
        },
        menuLabel: {
            flex: 1,
            fontSize: fontSize.md,
            fontWeight: "500",
            color: colors.text,
        },
        divider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            marginLeft: spacing.md + 40 + spacing.md,
        },
        fab: {
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
        },
        fabPressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
    });
}
