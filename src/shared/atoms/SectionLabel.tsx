import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface SectionLabelProps {
    children: string;
    /** Optional control aligned to the right of the label. */
    right?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * The marker of a heading that does not add: a dot in the box a "+" takes,
 * so "• RECENT WORKOUTS" and "+ EXERCISES" start their text at the same x.
 */
export function SectionBullet() {
    const colors = useThemeColors();
    return (
        <View style={styles.bulletBox}>
            <View style={[styles.bullet, { backgroundColor: colors.textTertiary }]} />
        </View>
    );
}

/** Small caps of every group heading — shared with `SectionHeader`. */
export const sectionTitleText = {
    fontSize: fontSize.xxs - 1,
    fontWeight: "600",
    letterSpacing: 0.9,
    textTransform: "uppercase",
} as const;

/**
 * The one heading for a group of fields, rows or cards: "• SMALL CAPS".
 * The dot says it is only a heading; a heading that adds is a
 * `SectionHeader` with `onAdd`, which shows a "+" in its place.
 */
export default function SectionLabel({ children, right, style }: SectionLabelProps) {
    const colors = useThemeColors();
    return (
        <View style={[styles.row, style]}>
            <View style={styles.label}>
                <SectionBullet />
                <Text style={[styles.text, { color: colors.textTertiary }]} numberOfLines={1}>
                    {children}
                </Text>
            </View>
            {right}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
        minHeight: 20,
        // Same inset as SectionHeader, so both kinds of heading line up.
        paddingHorizontal: 2,
    },
    label: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
    text: { flexShrink: 1, ...sectionTitleText },
    // Same box as SectionHeader's 15pt "+" glyph.
    bulletBox: { width: 15, height: 15, alignItems: "center", justifyContent: "center" },
    bullet: { width: 5, height: 5, borderRadius: 3 },
});
