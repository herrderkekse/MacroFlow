import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
}

/**
 * The one button. `primary` is the single main action of a view, `secondary`
 * a tonal alternative, `outline` a neutral action, `ghost` an inline text
 * action and `danger` a destructive one.
 */
export default function Button({
    title,
    onPress,
    variant = "primary",
    size = "md",
    disabled = false,
    loading = false,
    icon,
    style,
    textStyle,
}: ButtonProps) {
    const colors = useThemeColors();
    const variantStyles = useMemo(() => getVariantStyles(colors), [colors]);
    const variantTextStyles = useMemo(() => getVariantTextStyles(colors), [colors]);
    const isDisabled = disabled || loading;

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled }}
            style={({ pressed }) => [
                styles.base,
                size === "sm" && styles.small,
                variantStyles[variant],
                pressed && !isDisabled && styles.pressed,
                isDisabled && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={variantTextStyles[variant].color} />
            ) : (
                <>
                    {icon}
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.text,
                            size === "sm" && styles.smallText,
                            variantTextStyles[variant],
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </Pressable>
    );
}

/** Colour for an icon passed to a button of the given variant. */
export function buttonContentColor(colors: ThemeColors, variant: ButtonVariant = "primary"): string {
    return getVariantTextStyles(colors)[variant].color;
}

const styles = StyleSheet.create({
    base: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minHeight: controlHeight.md,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    small: { minHeight: controlHeight.sm, paddingHorizontal: spacing.sm + 4 },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.4 },
    text: { fontSize: fontSize.md, fontWeight: "600", flexShrink: 1 },
    smallText: { fontSize: fontSize.sm },
});

function getVariantStyles(colors: ThemeColors): Record<ButtonVariant, ViewStyle> {
    return {
        primary: { backgroundColor: colors.primary },
        secondary: { backgroundColor: colors.primaryLight },
        outline: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderStrong,
        },
        ghost: { backgroundColor: "transparent" },
        danger: { backgroundColor: colors.dangerLight },
    };
}

function getVariantTextStyles(colors: ThemeColors): Record<ButtonVariant, { color: string }> {
    return {
        primary: { color: colors.onPrimary },
        secondary: { color: colors.text },
        outline: { color: colors.text },
        ghost: { color: colors.text },
        danger: { color: colors.danger },
    };
}
