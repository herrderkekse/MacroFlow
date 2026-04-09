import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React, { useMemo } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    type TextStyle,
    type ViewStyle,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export default function Button({
    title,
    onPress,
    variant = "primary",
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
            style={({ pressed }) => [
                styles.base,
                variantStyles[variant],
                pressed && !isDisabled && styles.pressed,
                isDisabled && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === "primary" ? "#fff" : colors.primary}
                />
            ) : (
                <>
                    {icon}
                    <Text
                        style={[
                            styles.text,
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

const styles = StyleSheet.create({
    base: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    pressed: { opacity: 0.75 },
    disabled: { opacity: 0.45 },
    text: { fontSize: fontSize.md, fontWeight: "600" },
});

function getVariantStyles(colors: ThemeColors): Record<ButtonVariant, ViewStyle> {
    return {
        primary: { backgroundColor: colors.primary },
        secondary: { backgroundColor: colors.primaryLight },
        outline: {
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        ghost: { backgroundColor: "transparent" },
    };
}

function getVariantTextStyles(colors: ThemeColors): Record<ButtonVariant, TextStyle> {
    return {
        primary: { color: "#FFFFFF" },
        secondary: { color: colors.primary },
        outline: { color: colors.text },
        ghost: { color: colors.primary },
    };
}
