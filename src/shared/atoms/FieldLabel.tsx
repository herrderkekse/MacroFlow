import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

interface FieldLabelProps {
    children: string;
    style?: StyleProp<TextStyle>;
}

/**
 * The label above a single control that is not an `Input` (which carries its
 * own, identical label): a segmented control, a chip row, a picker.
 */
export default function FieldLabel({ children, style }: FieldLabelProps) {
    const colors = useThemeColors();
    return <Text style={[styles.label, { color: colors.textSecondary }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
    label: {
        fontSize: fontSize.xs,
        fontWeight: "600",
        marginTop: spacing.md,
        marginBottom: spacing.xs + 2,
    },
});
