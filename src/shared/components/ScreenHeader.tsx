import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    /**
     * `large` — a tab root: big left-aligned title, no back button.
     * `default` — a pushed screen: back button, compact title.
     */
    variant?: "large" | "default";
    /** Overrides what the back button does (defaults to going back one screen). */
    onBack?: () => void;
    /** `close` for screens that are a self-contained task rather than a level deeper. */
    backIcon?: "back" | "close";
    /** Makes the title a button (e.g. the log's date opens the calendar). */
    onTitlePress?: () => void;
    /** Up to three actions on the right, normally `IconButton`s. */
    right?: React.ReactNode;
    /** Rendered below the title row and scrolls with nothing: search, filters. */
    children?: React.ReactNode;
}

function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
}

/**
 * The one screen header. Every screen renders it as its first child, so the
 * title sits at the same height, in the same type, with the same inset on
 * every tab and every pushed screen.
 */
export default function ScreenHeader({
    title,
    subtitle,
    variant = "default",
    onBack,
    backIcon = "back",
    onTitlePress,
    right,
    children,
}: ScreenHeaderProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const isLarge = variant === "large";

    const titleBlock = (
        <View style={styles.titleBlock}>
            <View style={styles.titleLine}>
                <Text
                    style={isLarge ? styles.largeTitle : styles.title}
                    numberOfLines={1}
                    accessibilityRole="header"
                >
                    {title}
                </Text>
                {onTitlePress && (
                    <Ionicons name="chevron-down" size={isLarge ? 18 : 14} color={colors.textTertiary} />
                )}
            </View>
            {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            ) : null}
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={[styles.row, isLarge ? styles.rowLarge : styles.rowDefault]}>
                {!isLarge && (
                    <IconButton
                        icon={backIcon === "close" ? "close" : "chevron-back"}
                        label={backIcon === "close" ? t("common.close") : t("common.back")}
                        onPress={onBack ?? goBack}
                        style={styles.backButton}
                    />
                )}
                {onTitlePress ? (
                    <Pressable
                        onPress={onTitlePress}
                        style={({ pressed }) => [styles.titlePressable, pressed && styles.pressed]}
                        accessibilityRole="button"
                    >
                        {titleBlock}
                    </Pressable>
                ) : (
                    <View style={styles.titlePressable}>{titleBlock}</View>
                )}
                {right ? <View style={styles.right}>{right}</View> : null}
            </View>
            {children ? <View style={styles.below}>{children}</View> : null}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { backgroundColor: colors.background },
        row: {
            flexDirection: "row",
            alignItems: "center",
            paddingRight: screenPadding - spacing.sm,
        },
        rowLarge: { minHeight: 64, paddingLeft: screenPadding, paddingTop: spacing.sm },
        rowDefault: { minHeight: 56, paddingLeft: screenPadding - spacing.sm },
        backButton: { marginRight: spacing.xs },
        titlePressable: { flex: 1, justifyContent: "center" },
        pressed: { opacity: 0.6 },
        titleBlock: { justifyContent: "center" },
        titleLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
        largeTitle: {
            flexShrink: 1,
            fontSize: fontSize.xxl,
            fontWeight: "700",
            letterSpacing: -0.6,
            color: colors.text,
        },
        title: {
            flexShrink: 1,
            fontSize: fontSize.lg,
            fontWeight: "700",
            letterSpacing: -0.2,
            color: colors.text,
        },
        subtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
        right: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: spacing.sm },
        below: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.sm },
    });
}
