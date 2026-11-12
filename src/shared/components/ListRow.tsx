import type { IconName } from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ListRowProps {
    title: string;
    subtitle?: string;
    icon?: IconName;
    /** Short value shown on the right, before the chevron (e.g. "Metric"). */
    value?: string;
    /** Replaces value + chevron with a custom control (switch, button, spinner). */
    right?: React.ReactNode;
    onPress?: () => void;
    /** Defaults to true for pressable rows without a custom `right`. */
    showChevron?: boolean;
    destructive?: boolean;
    disabled?: boolean;
}

/**
 * The one row for menus, settings and action lists: optional icon tile,
 * title + subtitle, then a value, control or chevron.
 */
export default function ListRow({
    title,
    subtitle,
    icon,
    value,
    right,
    onPress,
    showChevron,
    destructive = false,
    disabled = false,
}: ListRowProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const tint = destructive ? colors.danger : colors.text;
    const hasChevron = showChevron ?? (!!onPress && !right);

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || !onPress}
            accessibilityRole={onPress ? "button" : undefined}
            accessibilityState={{ disabled }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
        >
            {icon && (
                <View style={[styles.iconTile, destructive && { backgroundColor: colors.dangerLight }]}>
                    <Ionicons name={icon} size={18} color={tint} />
                </View>
            )}
            <View style={styles.main}>
                <Text style={[styles.title, { color: tint }]} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text> : null}
            </View>
            {right}
            {!right && value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
            {hasChevron && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 4,
            minHeight: 56,
            paddingHorizontal: screenPadding,
            paddingVertical: spacing.sm + 2,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        disabled: { opacity: 0.4 },
        iconTile: {
            width: 36,
            height: 36,
            borderRadius: borderRadius.sm + 2,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
        },
        main: { flex: 1 },
        title: { fontSize: fontSize.md, fontWeight: "500" },
        subtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
        value: { fontSize: fontSize.sm, color: colors.textSecondary, maxWidth: "40%" },
    });
}
