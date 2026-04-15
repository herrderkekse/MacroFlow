import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, Text } from "react-native";
import type { ExerciseSet } from "../services/exerciseDb";

type ExerciseType = "weight" | "bodyweight" | "cardio";

export function ScheduledCells({ set, exerciseType, textColor, styles }: {
    set: ExerciseSet; exerciseType: ExerciseType; textColor: string;
    styles: ReturnType<typeof createSetInputStyles>;
}) {
    return (
        <>
            {exerciseType === "weight" && (
                <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                    {set.weight != null ? `${set.weight} ${set.weight_unit}` : "—"}
                </Text>
            )}
            {exerciseType !== "cardio" && (
                <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                    {set.reps ?? "—"}
                </Text>
            )}
            {exerciseType === "cardio" && (
                <>
                    <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                        {set.duration_seconds ? `${set.duration_seconds}s` : "—"}
                    </Text>
                    <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                        {set.distance_meters ? `${set.distance_meters}m` : "—"}
                    </Text>
                </>
            )}
            {exerciseType !== "cardio" && (
                <Text style={[styles.setCell, styles.rirCol, { color: textColor }]}>
                    {set.rir ?? "—"}
                </Text>
            )}
        </>
    );
}

export function createSetInputStyles(colors: ThemeColors) {
    return StyleSheet.create({
        setRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm,
        },
        activeRow: {
            backgroundColor: colors.surfaceVariant ?? colors.background,
            borderRadius: borderRadius.sm,
            marginHorizontal: -(spacing.xs - 2),
            paddingHorizontal: spacing.xs,
        },
        setRowScheduled: {
            opacity: 0.6,
        },
        setCell: {
            fontSize: fontSize.sm,
        },
        setCol: { width: 32, justifyContent: "center" },
        valueCol: { flex: 1, textAlign: "center" },
        rirCol: { width: 36, textAlign: "center" },
        checkCol: { width: 28, alignItems: "center" },
        input: {
            fontSize: fontSize.sm,
            textAlign: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: 2,
            marginHorizontal: 2,
        },
        inlineInput: {
            fontSize: fontSize.sm,
            textAlign: "center",
            paddingVertical: 2,
            marginHorizontal: 2,
        },
        weightInputGroup: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
        },
        weightInput: {
            textAlign: "right",
            minWidth: 48,
        },
        unitToggle: {
            paddingLeft: 2,
            paddingRight: spacing.xs,
            paddingVertical: 2,
            minWidth: 28,
        },
        unitText: {
            fontSize: fontSize.xs,
            fontWeight: "700",
        },
    });
}
