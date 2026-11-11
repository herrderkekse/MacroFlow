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

/** The one heading for a group of fields, rows or cards: small uppercase caps. */
export default function SectionLabel({ children, right, style }: SectionLabelProps) {
    const colors = useThemeColors();
    return (
        <View style={[styles.row, style]}>
            <Text style={[styles.text, { color: colors.textTertiary }]} numberOfLines={1}>
                {children}
            </Text>
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
    },
    text: {
        flexShrink: 1,
        fontSize: fontSize.xxs,
        fontWeight: "700",
        letterSpacing: 0.9,
        textTransform: "uppercase",
    },
});
