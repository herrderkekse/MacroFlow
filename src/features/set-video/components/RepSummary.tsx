import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatVelocity } from "../helpers/barPathFormat";
import type { RepAnalysis } from "../types";

/** The set's figures in one row: reps, the fastest one, and how much slower the last one was. */
export default function RepSummary({ analysis }: { analysis: RepAnalysis }) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { reps, velocityLoss } = analysis;
    const fastest = Math.max(0, ...reps.map((r) => r.meanVelocity));

    const figures = [
        { value: String(reps.length), label: t("barPath.repCount", { count: reps.length }) },
        { value: reps.length > 0 ? formatVelocity(fastest) : "–", label: t("barPath.bestVelocity") },
        { value: velocityLoss != null ? `${Math.round(velocityLoss * 100)} %` : "–", label: t("barPath.velocityLoss") },
    ];

    return (
        <View style={styles.row}>
            {figures.map((figure) => (
                <View key={figure.label} style={styles.figure}>
                    <Text style={styles.value} numberOfLines={1}>{figure.value}</Text>
                    <Text style={styles.label} numberOfLines={1}>{figure.label}</Text>
                </View>
            ))}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { flex: 1, flexDirection: "row", gap: spacing.md },
        figure: { flex: 1 },
        value: { color: colors.text, fontSize: fontSize.lg, fontWeight: "600", fontVariant: ["tabular-nums"] },
        label: { color: colors.textSecondary, fontSize: fontSize.xs },
    });
}
