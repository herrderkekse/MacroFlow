import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";

interface ReadOnlyExerciseCardProps {
    item: WorkoutExerciseWithSets;
    onCopy?: () => void;
}

export default function ReadOnlyExerciseCard({ item, onCopy }: ReadOnlyExerciseCardProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const exerciseType: ExerciseType = (item.exerciseTemplate?.type as ExerciseType) ?? "weight";
    const completedSets = item.sets.filter((s) => !!s.completed_at);

    return (
        <View style={styles.card}>
            {/* Title row: date + copy icon */}
            <View style={styles.titleRow}>
                <Text style={styles.dateText}>{item.workout.date}</Text>
                {onCopy && (
                    <Pressable onPress={onCopy} hitSlop={8}>
                        <Ionicons name="copy-outline" size={18} color={colors.primary} />
                    </Pressable>
                )}
            </View>

            {/* Column headers */}
            <View style={styles.headerRow}>
                <Text style={[styles.headerCell, styles.setCol]}>{t("exercise.exerciseCard.set")}</Text>
                {exerciseType === "weight" && (
                    <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.weight")}</Text>
                )}
                {exerciseType !== "cardio" && (
                    <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.reps")}</Text>
                )}
                {exerciseType === "cardio" && (
                    <>
                        <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.duration")}</Text>
                        <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.distance")}</Text>
                    </>
                )}
                {exerciseType !== "cardio" && (
                    <Text style={[styles.headerCell, styles.rirCol]}>{t("exercise.exerciseCard.rir")}</Text>
                )}
            </View>

            {/* Set rows */}
            {completedSets.map((set, i) => (
                <ReadOnlySetRow key={set.id} set={set} index={i} exerciseType={exerciseType} styles={styles} colors={colors} />
            ))}

            {completedSets.length === 0 && (
                <Text style={styles.emptyText}>{t("exercise.exerciseCard.noSetsYet")}</Text>
            )}
        </View>
    );
}

function ReadOnlySetRow({ set, index, exerciseType, styles, colors }: {
    set: ExerciseSet; index: number; exerciseType: ExerciseType;
    styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof useThemeColors>;
}) {
    const textColor = colors.text;
    return (
        <View style={styles.setRow}>
            <Text style={[styles.setCell, styles.setCol, { color: colors.textSecondary }]}>{index + 1}</Text>
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
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.sm,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.sm,
        },
        dateText: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingBottom: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: spacing.xs,
        },
        headerCell: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
        },
        setCol: { width: 32 },
        valueCol: { flex: 1, textAlign: "center" },
        rirCol: { width: 36, textAlign: "center" },
        setRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.xs,
        },
        setCell: {
            fontSize: fontSize.sm,
            textAlign: "center",
        },
        emptyText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            textAlign: "center",
            paddingVertical: spacing.sm,
        },
    });
}
