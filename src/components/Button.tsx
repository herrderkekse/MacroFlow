import React from "react";
import {
    Pressable,
    Text,
    StyleSheet,
    ActivityIndicator,
    type ViewStyle,
    type TextStyle,
} from "react-native";
import { colors, borderRadius, spacing, fontSize } from "@/src/utils/theme";

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

const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.primaryLight },
    outline: {
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    ghost: { backgroundColor: "transparent" },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
    primary: { color: "#FFFFFF" },
    secondary: { color: colors.primary },
    outline: { color: colors.text },
    ghost: { color: colors.primary },
};
