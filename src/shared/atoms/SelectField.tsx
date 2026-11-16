import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface SelectFieldProps {
    label?: string;
    /** The current choice, already formatted for display. */
    value: string;
    onPress: () => void;
    containerStyle?: StyleProp<ViewStyle>;
}

/**
 * A field whose value is chosen elsewhere: it looks like an `Input`, and
 * tapping it opens the sheet that holds the options.
 */
export default function SelectField({ label, value, onPress, containerStyle }: SelectFieldProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={containerStyle}>
            {label && <Text style={styles.label}>{label}</Text>}
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [styles.well, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={label ? `${label}: ${value}` : value}
            >
                <Text style={styles.value} numberOfLines={1}>{value}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
            </Pressable>
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
        well: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: controlHeight.md,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: borderRadius.md,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        value: { flex: 1, fontSize: fontSize.md, color: colors.text },
    });
}
