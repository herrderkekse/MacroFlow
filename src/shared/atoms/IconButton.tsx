import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

type IconButtonVariant = "plain" | "tonal" | "filled" | "outline";

interface IconButtonProps {
    icon: IconName;
    onPress: () => void;
    /** Read out by screen readers — icon-only buttons have no visible text. */
    label: string;
    variant?: IconButtonVariant;
    size?: "sm" | "md";
    /** Overrides the icon colour (e.g. `colors.danger`). */
    color?: string;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
}

const BOX = { sm: 32, md: 40 } as const;
const GLYPH = { sm: 18, md: 22 } as const;

/** The one icon-only button. Always at least a 40pt target (hitSlop on `sm`). */
export default function IconButton({
    icon,
    onPress,
    label,
    variant = "plain",
    size = "md",
    color,
    disabled = false,
    style,
}: IconButtonProps) {
    const colors = useThemeColors();

    const background =
        variant === "filled" ? colors.primary :
        variant === "tonal" ? colors.primaryLight :
        variant === "outline" ? colors.surface :
        "transparent";
    const tint = color ?? (variant === "filled" ? colors.onPrimary : colors.text);

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            hitSlop={size === "sm" ? 8 : 4}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            style={({ pressed }) => [
                styles.base,
                { width: BOX[size], height: BOX[size], backgroundColor: background },
                variant === "outline" && { borderWidth: 1, borderColor: colors.borderStrong },
                pressed && styles.pressed,
                disabled && styles.disabled,
                style,
            ]}
        >
            <Ionicons name={icon} size={GLYPH[size]} color={tint} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        alignItems: "center",
        justifyContent: "center",
        borderRadius: borderRadius.full,
    },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.35 },
});
