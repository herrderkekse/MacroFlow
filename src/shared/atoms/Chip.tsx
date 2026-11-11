import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

interface ChipProps {
    label: string;
    selected?: boolean;
    onPress?: () => void;
    icon?: React.ComponentProps<typeof Ionicons>["name"];
    /** Fill used while selected; defaults to the ink colour. */
    accentColor?: string;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one pill for choosing among a few options or toggling a filter.
 * Selected is always a solid fill, unselected always an outline.
 */
export default function Chip({ label, selected = false, onPress, icon, accentColor, disabled = false, style }: ChipProps) {
    const colors = useThemeColors();
    const fill = accentColor ?? colors.primary;
    const contentColor = selected ? colors.onPrimary : colors.textSecondary;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || !onPress}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [
                styles.base,
                selected
                    ? { backgroundColor: fill, borderColor: fill }
                    : { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                pressed && styles.pressed,
                disabled && styles.disabled,
                style,
            ]}
        >
            {icon && <Ionicons name={icon} size={15} color={contentColor} />}
            <Text numberOfLines={1} style={[styles.text, { color: contentColor }, selected && styles.textSelected]}>
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs + 2,
        minHeight: controlHeight.sm,
        paddingHorizontal: spacing.sm + 6,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.4 },
    text: { fontSize: fontSize.sm, fontWeight: "500" },
    textSelected: { fontWeight: "600" },
});
