import React from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    type TextInputProps,
    type ViewStyle,
} from "react-native";
import { colors, borderRadius, spacing, fontSize } from "@/src/utils/theme";

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

const styles = StyleSheet.create({
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
