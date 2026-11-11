import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export interface SegmentOption<T extends string | number> {
    key: T;
    label: string;
    icon?: React.ComponentProps<typeof Ionicons>["name"];
}

interface SegmentedControlProps<T extends string | number> {
    options: SegmentOption<T>[];
    value: T | null;
    onChange: (key: T) => void;
    size?: "sm" | "md";
    style?: StyleProp<ViewStyle>;
}

/**
 * The one control for picking exactly one of 2–4 mutually exclusive options
 * that fit in a row (appearance, units, meal, move/copy). For filters and
 * longer or scrolling sets use `Chip`s.
 */
export default function SegmentedControl<T extends string | number>({
    options,
    value,
    onChange,
    size = "md",
    style,
}: SegmentedControlProps<T>) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={[styles.track, style]} accessibilityRole="tablist">
            {options.map((option) => {
                const isSelected = option.key === value;
                const tint = isSelected ? colors.onPrimary : colors.textSecondary;
                return (
                    <Pressable
                        key={String(option.key)}
                        onPress={() => onChange(option.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isSelected }}
                        style={({ pressed }) => [
                            styles.segment,
                            size === "sm" && styles.segmentSmall,
                            isSelected && styles.segmentSelected,
                            pressed && !isSelected && styles.pressed,
                        ]}
                    >
                        {option.icon && <Ionicons name={option.icon} size={16} color={tint} />}
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={[styles.label, { color: tint }, isSelected && styles.labelSelected]}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        track: {
            flexDirection: "row",
            gap: 3,
            padding: 3,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
        },
        segment: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: controlHeight.md - 8,
            paddingHorizontal: 6,
            borderRadius: borderRadius.md - 3,
        },
        segmentSmall: { minHeight: controlHeight.sm - 8 },
        segmentSelected: { backgroundColor: colors.primary },
        pressed: { backgroundColor: colors.surfaceMuted },
        label: { fontSize: fontSize.sm, fontWeight: "500", flexShrink: 1 },
        labelSelected: { fontWeight: "600" },
    });
}
