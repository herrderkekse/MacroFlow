import type { IconName } from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, floatingShadow, screenPadding } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

interface FabProps {
    onPress: () => void;
    /** Read out by screen readers. */
    label: string;
    icon?: IconName;
    /** Distance from the bottom edge of its container. */
    bottom?: number;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one floating action button: the "create" action of a tab root. When a
 * screen can create several things it opens an `ActionSheet` of labeled
 * choices rather than fanning out more floating buttons.
 */
export default function Fab({ onPress, label, icon = "add", bottom = screenPadding, style }: FabProps) {
    const colors = useThemeColors();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [
                styles.fab,
                { bottom, backgroundColor: colors.primary },
                pressed && styles.pressed,
                style,
            ]}
        >
            <Ionicons name={icon} size={28} color={colors.onPrimary} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: "absolute",
        right: screenPadding,
        width: 56,
        height: 56,
        borderRadius: borderRadius.lg,
        alignItems: "center",
        justifyContent: "center",
        ...floatingShadow,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
