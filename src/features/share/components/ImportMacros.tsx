// Compact "412 · 34P 38C 12F" macro strip shown under an import slide's title.

import type { Macros } from "@/src/features/share/services/importPlan";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

export default function ImportMacros({ macros, colors }: { macros: Macros; colors: ThemeColors }) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.row}>
            <Text style={[styles.value, { color: colors.calories }]}>
                {macros.calories} {t("common.kcal")}
            </Text>
            <View style={styles.dot} />
            <Text style={[styles.value, { color: colors.protein }]}>
                {macros.protein}
                {t("common.proteinShort")}
            </Text>
            <Text style={[styles.value, { color: colors.carbs }]}>
                {macros.carbs}
                {t("common.carbsShort")}
            </Text>
            <Text style={[styles.value, { color: colors.fat }]}>
                {macros.fat}
                {t("common.fatShort")}
            </Text>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
        value: { fontSize: fontSize.sm, fontWeight: "800" },
        dot: { width: 3, height: 3, borderRadius: 999, backgroundColor: colors.border },
    });
}
