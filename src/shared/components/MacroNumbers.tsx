import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface MacroNumbersProps {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** `md` for a row of its own, `sm` for a section header. */
    size?: "sm" | "md";
    /** Dim everything, for planned-but-not-eaten items. */
    muted?: boolean;
    style?: StyleProp<ViewStyle>;
}

const MACROS = ["protein", "carbs", "fat"] as const;

/**
 * The bare figures of an amount — "233  10  40  4": calories in ink, then
 * protein, carbs and fat in grams, each in its macro colour. Where the
 * colours alone are not enough, use `MacroInline`, which spells out P · C · F.
 */
export default function MacroNumbers({ calories, protein, carbs, fat, size = "md", muted = false, style }: MacroNumbersProps) {
    const colors = useThemeColors();
    const grams = { protein, carbs, fat };
    const isSmall = size === "sm";

    return (
        <View style={[styles.row, isSmall && styles.rowSmall, style]}>
            <Text style={[styles.calories, isSmall && styles.caloriesSmall, { color: muted ? colors.textTertiary : colors.text }]}>
                {Math.round(calories)}
            </Text>
            {MACROS.map((macro) => (
                <Text
                    key={macro}
                    style={[styles.macro, isSmall && styles.macroSmall, { color: muted ? colors.textTertiary : colors[macro] }]}
                >
                    {Math.round(grams[macro])}
                </Text>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
    rowSmall: { gap: spacing.sm - 1 },
    calories: { fontSize: fontSize.sm, fontWeight: "600", fontVariant: ["tabular-nums"] },
    caloriesSmall: { fontSize: fontSize.xxs - 1 },
    macro: { fontSize: fontSize.xxs, fontWeight: "500", fontVariant: ["tabular-nums"] },
    macroSmall: { fontSize: fontSize.xxs - 1 },
});
