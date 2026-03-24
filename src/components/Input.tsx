import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import React, { useMemo } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    type TextInputProps,
    type ViewStyle,
} from "react-native";

interface InputProps extends TextInputProps {
    label?: string;
    suffix?: string;
    containerStyle?: ViewStyle;
}

export default function Input({
    label,
    suffix,
    containerStyle,
    style,
    ...rest
}: InputProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={containerStyle}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={styles.row}>
                <TextInput
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, suffix && styles.inputWithSuffix, style]}
                    {...rest}
                />
                {suffix && <Text style={styles.suffix}>{suffix}</Text>}
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        label: {
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.textSecondary,
            marginBottom: spacing.xs,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
        },
        input: {
            flex: 1,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md,
            fontSize: fontSize.md,
            color: colors.text,
        },
        inputWithSuffix: {
            paddingRight: spacing.xs,
        },
        suffix: {
            paddingRight: spacing.md,
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
    });
}
