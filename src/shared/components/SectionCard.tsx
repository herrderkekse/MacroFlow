import type { IconName } from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface SectionCardProps {
    /** Shown in small caps above the card ("+ BREAKFAST"). */
    title: string;
    /** Makes the label an add button, with a "+" in front of it. */
    onAdd?: () => void;
    addLabel?: string;
    /** Faint note after the label ("2 photos"). */
    hint?: string;
    /** Right end of the label row: totals, a small extra action. */
    aside?: React.ReactNode;
    /** Replaces the label's own press (e.g. selecting a whole meal). */
    onHeaderPress?: () => void;
    onHeaderLongPress?: () => void;
    /** Shown instead of the card while there is nothing in it. */
    empty?: { icon: IconName; label: string; onPress?: () => void };
    /** Draws the selection outline. */
    selected?: boolean;
    /** The first section of a page sits closer to what is above it. */
    first?: boolean;
    /** Leaves the children unframed (e.g. a row of photo tiles). */
    bare?: boolean;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one titled group on a day or detail page: a small-caps label that
 * doubles as the add button, then a card of rows — or, while empty, a dashed
 * placeholder that adds too. The log's meals, weight, training and photos
 * all share it.
 */
export default function SectionCard({
    title,
    onAdd,
    addLabel,
    hint,
    aside,
    onHeaderPress,
    onHeaderLongPress,
    empty,
    selected = false,
    first = false,
    bare = false,
    children,
    style,
}: SectionCardProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const hasBody = React.Children.toArray(children).length > 0;
    const onLabelPress = onHeaderPress ?? onAdd;

    return (
        <View style={style}>
            <View style={[styles.header, first && styles.headerFirst]}>
                <Pressable
                    onPress={onLabelPress}
                    onLongPress={onHeaderLongPress}
                    disabled={!onLabelPress && !onHeaderLongPress}
                    hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }}
                    style={({ pressed }) => [styles.label, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={onAdd && !onHeaderPress ? (addLabel ?? title) : title}
                >
                    {onAdd && <Ionicons name="add" size={15} color={colors.textSecondary} />}
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                </Pressable>
                {hint ? <Text style={styles.hint} numberOfLines={1}>{hint}</Text> : null}
                <View style={styles.spacer} />
                {aside}
            </View>

            {hasBody ? (
                bare ? children : <View style={[styles.card, selected && styles.selected]}>{children}</View>
            ) : empty ? (
                <Pressable
                    onPress={empty.onPress ?? onAdd}
                    disabled={!(empty.onPress ?? onAdd)}
                    style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
                    accessibilityRole="button"
                >
                    <Ionicons name={empty.icon} size={16} color={colors.textSecondary} />
                    <Text style={styles.emptyText} numberOfLines={1}>{empty.label}</Text>
                </Pressable>
            ) : null}
        </View>
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
        title: {
            fontSize: fontSize.xxs - 1,
            fontWeight: "600",
            letterSpacing: 0.9,
            textTransform: "uppercase",
            color: colors.textTertiary,
        },
        hint: { flexShrink: 1, fontSize: fontSize.xxs, color: colors.textTertiary, opacity: 0.75 },
        spacer: { flex: 1 },
        card: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
        },
        selected: { borderColor: colors.primary },
        empty: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            height: 46,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.borderStrong,
            backgroundColor: colors.background,
        },
        emptyText: { fontSize: fontSize.sm - 1, fontWeight: "500", color: colors.textSecondary },
    });
}
