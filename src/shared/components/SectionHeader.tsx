import { SectionBullet, sectionTitleText } from "@/src/shared/atoms/SectionLabel";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";

export interface SectionHeaderProps {
    /** Shown in small caps ("+ BREAKFAST"). */
    title: string;
    /**
     * Makes the label an add button, with a "+" in front of it. Without it
     * the heading gets a dot instead ("• RECENT WORKOUTS"): every heading
     * carries one of the two, so the marker says whether tapping it adds.
     */
    onAdd?: () => void;
    addLabel?: string;
    /** Faint note on the right ("2 photos", "3 items"): counts never go in the title. */
    hint?: string;
    /** Right end of the row: totals, a small extra action. */
    aside?: React.ReactNode;
    /** Replaces the label's own press (e.g. selecting a whole meal). */
    onHeaderPress?: () => void;
    onHeaderLongPress?: () => void;
    /** The first section of a page sits closer to what is above it. */
    first?: boolean;
    onLayout?: (e: LayoutChangeEvent) => void;
    style?: StyleProp<ViewStyle>;
}

/**
 * The label above a group on a page: small caps that double as the add
 * button. `SectionCard` puts one above its card; use it alone where the
 * heading is pinned apart from its rows.
 */
export default function SectionHeader({
    title, onAdd, addLabel, hint, aside, onHeaderPress, onHeaderLongPress, first = false, onLayout, style,
}: SectionHeaderProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const onLabelPress = onHeaderPress ?? onAdd;

    // The whole row is the target, not just the label: the far end of it is
    // where a right thumb lands. Buttons inside `aside` keep their own press.
    return (
        <Pressable
            onPress={onLabelPress}
            onLongPress={onHeaderLongPress}
            disabled={!onLabelPress && !onHeaderLongPress}
            onLayout={onLayout}
            style={({ pressed }) => [styles.header, first && styles.headerFirst, style, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={onAdd && !onHeaderPress ? (addLabel ?? title) : title}
        >
            <View style={styles.label}>
                {onAdd ? <Ionicons name="add" size={15} color={colors.textSecondary} /> : <SectionBullet />}
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            <View style={styles.spacer} />
            {hint ? <Text style={styles.hint} numberOfLines={1}>{hint}</Text> : null}
            {aside}
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 2,
            paddingTop: spacing.lg - 2,
            paddingBottom: spacing.sm + 2,
            paddingHorizontal: 2,
        },
        headerFirst: { paddingTop: spacing.xs },
        label: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
        pressed: { opacity: 0.6 },
        title: { ...sectionTitleText, color: colors.textTertiary },
        hint: { flexShrink: 1, fontSize: fontSize.xxs, color: colors.textTertiary, opacity: 0.75 },
        spacer: { flex: 1 },
    });
}
