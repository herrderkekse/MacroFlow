import Card from "@/src/shared/atoms/Card";
import IconButton, { type IconName } from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface SectionCardProps {
    title: string;
    icon?: IconName;
    /** Line under the title (totals, counts). A node allows coloured macros. */
    summary?: React.ReactNode;
    /** Short value at the right of the header, before the actions. */
    value?: string;
    /** Adds the standard "+" button. */
    onAdd?: () => void;
    addLabel?: string;
    /** Extra header actions, placed before the "+" button. */
    actions?: React.ReactNode;
    onHeaderPress?: () => void;
    onHeaderLongPress?: () => void;
    /** Draws the selection outline. */
    selected?: boolean;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one card for a titled group of rows on a day or detail page: the
 * meals, weight, workouts and photos of the log all share this header, so
 * the title, the summary and the "+" sit in the same place on each.
 */
export default function SectionCard({
    title,
    icon,
    summary,
    value,
    onAdd,
    addLabel,
    actions,
    onHeaderPress,
    onHeaderLongPress,
    selected = false,
    children,
    style,
}: SectionCardProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const hasBody = React.Children.toArray(children).length > 0;

    return (
        <Card padded={false} style={[styles.card, selected && styles.selected, style]}>
            <Pressable
                onPress={onHeaderPress}
                onLongPress={onHeaderLongPress}
                disabled={!onHeaderPress && !onHeaderLongPress}
                style={({ pressed }) => [styles.header, pressed && styles.pressed]}
            >
                {icon && <Ionicons name={icon} size={18} color={colors.textSecondary} />}
                <View style={styles.titleBlock}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    {typeof summary === "string" ? (
                        <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
                    ) : (
                        summary
                    )}
                </View>
                {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
                {actions}
                {onAdd && (
                    <IconButton icon="add" size="sm" variant="tonal" label={addLabel ?? title} onPress={onAdd} />
                )}
            </Pressable>
            {hasBody && <View style={styles.body}>{children}</View>}
        </Card>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: { marginBottom: spacing.sm + 4 },
        selected: { borderColor: colors.primary },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: 56,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        titleBlock: { flex: 1, gap: 2 },
        title: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
        summary: { fontSize: fontSize.xs, color: colors.textSecondary },
        value: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
            marginRight: spacing.xs,
        },
        body: {
            paddingHorizontal: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
    });
}
