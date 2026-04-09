import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Totals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface MacroMakeupBarProps {
    totals: Totals;
    scheduledTotals?: Totals;
    colors: ThemeColors;
    t: (key: string) => string;
}

export default function MacroMakeupBar({ totals, scheduledTotals, colors, t }: MacroMakeupBarProps) {
    const pCal = totals.protein * 4;
    const cCal = totals.carbs * 4;
    const fCal = totals.fat * 9;
    const total = pCal + cCal + fCal;

    if (total <= 0) return null;

    const pPct = Math.round((pCal / total) * 100);
    const cPct = Math.round((cCal / total) * 100);
    const fPct = Math.round((fCal / total) * 100);

    const hasScheduled = scheduledTotals && (scheduledTotals.protein > 0 || scheduledTotals.carbs > 0 || scheduledTotals.fat > 0);
    let pDiff = 0, cDiff = 0, fDiff = 0;
    if (hasScheduled) {
        const withP = (totals.protein + scheduledTotals.protein) * 4;
        const withC = (totals.carbs + scheduledTotals.carbs) * 4;
        const withF = (totals.fat + scheduledTotals.fat) * 9;
        const withTotal = withP + withC + withF;
        if (withTotal > 0) {
            pDiff = Math.round((withP / withTotal) * 100) - pPct;
            cDiff = Math.round((withC / withTotal) * 100) - cPct;
            fDiff = Math.round((withF / withTotal) * 100) - fPct;
        }
    }

    function formatDiff(diff: number): string {
        if (diff > 0) return ` +${diff}%`;
        if (diff < 0) return ` ${diff}%`;
        return ` +0%`;
    }

    return (
        <View style={styles.container}>
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: colors.protein }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                        {t("settings.protein")} {pPct}%
                        {hasScheduled && <Text style={{ color: colors.disabled }}>{formatDiff(pDiff)}</Text>}
                    </Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: colors.carbs }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                        {t("settings.carbs")} {cPct}%
                        {hasScheduled && <Text style={{ color: colors.disabled }}>{formatDiff(cDiff)}</Text>}
                    </Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: colors.fat }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                        {t("settings.fat")} {fPct}%
                        {hasScheduled && <Text style={{ color: colors.disabled }}>{formatDiff(fDiff)}</Text>}
                    </Text>
                </View>
            </View>
            <View style={styles.bar}>
                <View style={[styles.segment, { flex: pCal, backgroundColor: colors.protein, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]} />
                <View style={[styles.segment, { flex: cCal, backgroundColor: colors.carbs }]} />
                <View style={[styles.segment, { flex: fCal, backgroundColor: colors.fat, borderTopRightRadius: 3, borderBottomRightRadius: 3 }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: spacing.sm },
    bar: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden" },
    segment: { height: 6 },
    legendRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    legendText: { fontSize: fontSize.xs },
});
