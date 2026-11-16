import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize } from "@/src/utils/theme";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

interface MacroInlineProps {
    protein: number;
    carbs: number;
    fat: number;
    /** Dim everything, for planned-but-not-eaten items. */
    muted?: boolean;
    style?: StyleProp<TextStyle>;
}

const MACROS = [
    { key: "protein", labelKey: "common.proteinShort" },
    { key: "carbs", labelKey: "common.carbsShort" },
    { key: "fat", labelKey: "common.fatShort" },
] as const;

/**
 * The one compact macro readout: "P 10 · C 40 · F 4" in grams, each letter
 * in its macro colour. Used wherever a row or header summarises macros.
 */
export default function MacroInline({ protein, carbs, fat, muted = false, style }: MacroInlineProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const values = { protein, carbs, fat };

    return (
        <Text style={[styles.text, { color: muted ? colors.textTertiary : colors.textSecondary }, style]} numberOfLines={1}>
            {MACROS.map((macro, index) => (
                <React.Fragment key={macro.key}>
                    {index > 0 && <Text style={{ color: colors.textTertiary }}>{"  ·  "}</Text>}
                    <Text style={[styles.letter, { color: muted ? colors.textTertiary : colors[macro.key] }]}>
                        {t(macro.labelKey)}
                    </Text>
                    {" "}{Math.round(values[macro.key])}
                </React.Fragment>
            ))}
        </Text>
    );
}

const styles = StyleSheet.create({
    text: { fontSize: fontSize.xs, fontVariant: ["tabular-nums"] },
    letter: { fontWeight: "700" },
});
