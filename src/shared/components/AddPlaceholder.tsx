import type { IconName } from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

interface AddPlaceholderProps {
    label: string;
    icon?: IconName;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

/** A dashed slot that stands in for a card while it is empty ("Nothing logged — add food"), and adds. */
export default function AddPlaceholder({ label, icon = "add", onPress, style }: AddPlaceholderProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [styles.slot, pressed && styles.pressed, style]}
            accessibilityRole="button"
        >
            <Ionicons name={icon} size={16} color={colors.textSecondary} />
            <Text style={styles.text} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        slot: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            height: 46,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.borderStrong,
            backgroundColor: colors.background,
        },
        pressed: { opacity: 0.6 },
        text: { fontSize: fontSize.sm - 1, fontWeight: "500", color: colors.textSecondary },
    });
}
