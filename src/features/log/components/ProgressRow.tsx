import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

interface ProgressRowProps {
    label: string;
    current: number;
    goal: number;
    color: string;
    unit: string;
    colors: ThemeColors;
    scheduled?: number;
}

export default function ProgressRow({ label, current, goal, color, unit, colors, scheduled }: ProgressRowProps) {
    const ratio = goal > 0 ? Math.min(current / goal, 1) : 0;
    const scheduledRatio = goal > 0 && scheduled ? Math.min((current + scheduled) / goal, 1) : 0;
    const hasScheduled = scheduled != null && scheduled > 0;
    const rs = useMemo(() => createRowStyles(colors), [colors]);

    return (
        <View style={rs.container}>
            <View style={rs.labelRow}>
                <Text style={[rs.label, { color }]}>{label}</Text>
                <Text style={rs.values}>
                    {Math.round(current)}
                    {hasScheduled && <Text style={rs.scheduledValue}> + {Math.round(scheduled ?? 0)}</Text>}{" "}
                    <Text style={rs.separator}>/</Text>{" "}
                    {Math.round(goal)} {unit}
                </Text>
            </View>
            <View style={rs.track}>
                {hasScheduled && scheduledRatio > ratio && (
                    <View style={[rs.scheduledFill, { width: `${scheduledRatio * 100}%` }]} />
                )}
                <View style={[rs.fill, { backgroundColor: color, width: `${ratio * 100}%` }]} />
            </View>
        </View>
    );
}

function createRowStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { marginTop: spacing.sm },
        labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
        label: { fontSize: fontSize.xs, fontWeight: "600" },
        values: { fontSize: fontSize.xs, color: colors.textSecondary },
        scheduledValue: { color: colors.textTertiary },
        separator: { color: colors.textTertiary },
        track: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
        fill: { height: 6, borderRadius: 3 },
        scheduledFill: { position: "absolute", height: 6, borderRadius: 3, backgroundColor: colors.disabled },
    });
}
