import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useState } from "react";
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

/** The one text field: label above, optional unit suffix inside the well. */
export default function Input({
    label,
    suffix,
    containerStyle,
    style,
    onFocus,
    onBlur,
    multiline,
    ...rest
}: InputProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={containerStyle}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={[styles.row, multiline && styles.rowMultiline, isFocused && styles.rowFocused]}>
                <TextInput
                    placeholderTextColor={colors.textTertiary}
                    selectionColor={colors.textSecondary}
                    multiline={multiline}
                    style={[styles.input, multiline && styles.inputMultiline, suffix && styles.inputWithSuffix, style]}
                    onFocus={(e) => {
                        setIsFocused(true);
                        onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setIsFocused(false);
                        onBlur?.(e);
                    }}
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
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            marginBottom: spacing.xs + 2,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: controlHeight.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: borderRadius.md,
        },
        rowMultiline: { alignItems: "flex-start" },
        rowFocused: { borderColor: colors.primary },
        input: {
            flex: 1,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            fontSize: fontSize.md,
            color: colors.text,
        },
        inputMultiline: { paddingVertical: spacing.sm + 4, textAlignVertical: "top" },
        inputWithSuffix: { paddingRight: spacing.xs },
        suffix: {
            paddingRight: spacing.md,
            fontSize: fontSize.sm,
            color: colors.textTertiary,
        },
    });
}
