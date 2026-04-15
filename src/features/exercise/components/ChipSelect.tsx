import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

interface ChipSelectProps<T extends string> {
    items: { key: T; label: string }[];
    selected: T | null;
    onSelect: (key: T | null) => void;
    noneLabel?: string;
    horizontal?: boolean;
}

export default function ChipSelect<T extends string>({
    items, selected, onSelect, noneLabel, horizontal = true,
}: ChipSelectProps<T>) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const chips = (
        <>
            {noneLabel != null && (
                <Pressable
                    onPress={() => onSelect(null)}
                    style={[styles.chip, selected === null && styles.chipActive]}
                >
                    <Text style={[styles.chipText, selected === null && styles.chipTextActive]}>
                        {noneLabel}
                    </Text>
                </Pressable>
            )}
            {items.map((item) => (
                <Pressable
                    key={item.key}
                    onPress={() => onSelect(item.key)}
                    style={[styles.chip, selected === item.key && styles.chipActive]}
                >
                    <Text style={[styles.chipText, selected === item.key && styles.chipTextActive]}>
                        {item.label}
                    </Text>
                </Pressable>
            ))}
        </>
    );

    if (horizontal) {
        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {chips}
            </ScrollView>
        );
    }

    return <>{chips}</>;
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        chipRow: {
            flexDirection: "row",
            gap: spacing.sm,
            paddingBottom: spacing.xs,
        },
        chip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        chipActive: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
        },
        chipText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        chipTextActive: {
            color: colors.primary,
            fontWeight: "600",
        },
    });
}
