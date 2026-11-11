import type { IconName } from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, floatingShadow, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface SelectionAction {
    key: string;
    icon: IconName;
    label: string;
    onPress: () => void;
    destructive?: boolean;
    /** Shown dimmed; still pressable so it can explain why it is unavailable. */
    dimmed?: boolean;
}

interface SelectionBarProps {
    count: number;
    actions: SelectionAction[];
    onDone: () => void;
    /** Distance from the bottom edge of the screen content. */
    bottom: number;
}

/**
 * Replaces the "+" button while entries are selected: how many are selected,
 * a way out, and every bulk action as a labeled button.
 */
export default function SelectionBar({ count, actions, onDone, bottom }: SelectionBarProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={[styles.bar, { bottom }]}>
            <View style={styles.statusRow}>
                <Text style={styles.count}>{t("log.selectedCount", { count })}</Text>
                <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button">
                    <Text style={styles.done}>{t("common.done")}</Text>
                </Pressable>
            </View>
            <View style={styles.actions}>
                {actions.map((action) => {
                    const tint = action.destructive ? colors.danger : colors.text;
                    return (
                        <Pressable
                            key={action.key}
                            onPress={action.onPress}
                            accessibilityRole="button"
                            accessibilityLabel={action.label}
                            style={({ pressed }) => [styles.action, pressed && styles.pressed, action.dimmed && styles.dimmed]}
                        >
                            <Ionicons name={action.icon} size={21} color={tint} />
                            <Text style={[styles.actionLabel, { color: tint }]} numberOfLines={1}>{action.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        bar: {
            position: "absolute",
            left: screenPadding,
            right: screenPadding,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingTop: spacing.sm + 4,
            paddingBottom: spacing.sm,
            ...floatingShadow,
        },
        statusRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            marginBottom: spacing.xs,
        },
        count: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        done: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
        actions: { flexDirection: "row", paddingHorizontal: spacing.xs },
        action: {
            flex: 1,
            alignItems: "center",
            gap: 4,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        dimmed: { opacity: 0.4 },
        actionLabel: { fontSize: fontSize.xxs, fontWeight: "600" },
    });
}
