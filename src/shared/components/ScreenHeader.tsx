import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
    /**
     * Makes the title the field that edits it (a recipe's or a workout's
     * name): a pencil marks it, a tap turns it into an input. `title` stays
     * what is shown when not editing, so it can fall back to a default.
     */
    editableTitle?: EditableTitle;
    /** Up to three actions on the right, normally `IconButton`s. */
    right?: React.ReactNode;
    /** Rendered below the title row and scrolls with nothing: search, filters. */
    children?: React.ReactNode;
    /** Set to false when a wrapper (e.g. `CollapsibleHeader`) already pads for the status bar. */
    safeArea?: boolean;
}

interface EditableTitle {
    /** The stored name, possibly empty; edited live through `onChange`. */
    value: string;
    onChange: (value: string) => void;
    /** Shown in the input while the name is empty. */
    placeholder?: string;
    /** Label for screen readers on the title button (e.g. "Rename workout"). */
    label: string;
}

/** Line box of a large title; header actions centre against it. */
const LARGE_TITLE_LINE_HEIGHT = 36;

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
    editableTitle,
    right,
    children,
    safeArea = true,
}: ScreenHeaderProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const isLarge = variant === "large";
    const [editing, setEditing] = useState(false);

    // Android keeps a field focused after its keyboard is dismissed; treat
    // that as done editing, so the title goes back to being a heading.
    useEffect(() => {
        if (!editing) return;
        const sub = Keyboard.addListener("keyboardDidHide", () => setEditing(false));
        return () => sub.remove();
    }, [editing]);

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
                {editableTitle && (
                    <Ionicons name="pencil" size={13} color={colors.textTertiary} />
                )}
            </View>
            {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            ) : null}
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: safeArea ? insets.top : 0 }]}>
            <View style={[styles.row, isLarge ? styles.rowLarge : styles.rowDefault]}>
                {!isLarge && (
                    <IconButton
                        icon={backIcon === "close" ? "close" : "chevron-back"}
                        label={backIcon === "close" ? t("common.close") : t("common.back")}
                        onPress={onBack ?? goBack}
                        style={styles.backButton}
                    />
                )}
                {editableTitle && editing ? (
                    <View style={styles.titlePressable}>
                        <TextInput
                            style={styles.titleInput}
                            value={editableTitle.value}
                            onChangeText={editableTitle.onChange}
                            placeholder={editableTitle.placeholder}
                            placeholderTextColor={colors.textTertiary}
                            selectionColor={colors.textSecondary}
                            onBlur={() => setEditing(false)}
                            autoFocus
                            selectTextOnFocus
                            returnKeyType="done"
                        />
                        {subtitle ? (
                            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                        ) : null}
                    </View>
                ) : editableTitle ? (
                    <Pressable
                        onPress={() => setEditing(true)}
                        style={({ pressed }) => [styles.titlePressable, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={editableTitle.label}
                    >
                        {titleBlock}
                    </Pressable>
                ) : onTitlePress ? (
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
                {right ? <View style={[styles.right, isLarge && styles.rightLarge]}>{right}</View> : null}
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
        // Top-aligned, so the title starts at the same height on every tab
        // whether or not a subtitle sits under it.
        rowLarge: {
            alignItems: "flex-start",
            minHeight: 64,
            paddingLeft: screenPadding,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
        },
        rowDefault: { minHeight: 56, paddingLeft: screenPadding - spacing.sm },
        backButton: { marginRight: spacing.xs },
        titlePressable: { flex: 1, justifyContent: "center" },
        pressed: { opacity: 0.6 },
        titleBlock: { justifyContent: "center" },
        titleLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
        largeTitle: {
            flexShrink: 1,
            fontSize: fontSize.xxl,
            lineHeight: LARGE_TITLE_LINE_HEIGHT,
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
        // Same box as the title it replaces, underlined while it is a field.
        titleInput: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            letterSpacing: -0.2,
            color: colors.text,
            padding: 0,
            paddingBottom: 1,
            // The underline must not push the subtitle down (the title would jump).
            marginBottom: -2,
            borderBottomWidth: 1,
            borderBottomColor: colors.primary,
            includeFontPadding: false,
        },
        subtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
        right: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: spacing.sm },
        // Centred on the title line rather than on the whole title block.
        rightLarge: { height: LARGE_TITLE_LINE_HEIGHT },
        below: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.sm },
    });
}
