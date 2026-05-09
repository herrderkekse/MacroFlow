import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

interface SettingsToggleRowProps {
    colors: ThemeColors;
    label: string;
    description?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
}

export default function SettingsToggleRow({
    colors,
    label,
    description,
    value,
    onValueChange,
}: SettingsToggleRowProps) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <>
            <Text style={styles.sectionLabel}>{label}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
            <View style={styles.row}>
                <Text style={styles.valueLabel}>{label}</Text>
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={value ? colors.primaryLight : colors.surface}
                />
            </View>
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.md,
        },
        description: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            marginBottom: spacing.md,
            gap: spacing.md,
        },
        valueLabel: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.text,
            fontWeight: "500",
        },
    });
}