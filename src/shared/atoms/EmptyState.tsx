import type { IconName } from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface EmptyStateProps {
    title: string;
    message?: string;
    icon?: IconName;
    /** Optional call to action, normally a small `Button`. */
    action?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** The one placeholder for an empty list or a search without results. */
export default function EmptyState({ title, message, icon, action, style }: EmptyStateProps) {
    const colors = useThemeColors();
    return (
        <View style={[styles.container, style]}>
            {icon && <Ionicons name={icon} size={28} color={colors.textTertiary} />}
            <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
            {message ? <Text style={[styles.message, { color: colors.textTertiary }]}>{message}</Text> : null}
            {action}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
    title: { fontSize: fontSize.sm, fontWeight: "600", textAlign: "center" },
    message: { fontSize: fontSize.xs, textAlign: "center", lineHeight: 18, maxWidth: 280 },
});
