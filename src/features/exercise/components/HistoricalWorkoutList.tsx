import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
    copyWorkoutAsScheduled,
    getExercisesForWorkout,
    getRecentWorkouts,
    type Workout,
} from "../services/exerciseDb";

interface HistoricalWorkoutListProps {
    excludeWorkoutId?: number;
    onCopied?: () => void;
}

interface WorkoutRow {
    workout: Workout;
    exerciseCount: number;
    muscleGroups: string[];
}

export default function HistoricalWorkoutList({ excludeWorkoutId, onCopied }: HistoricalWorkoutListProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [rows, setRows] = useState<WorkoutRow[]>([]);

    useEffect(() => {
        queueMicrotask(() => {
            const recents = getRecentWorkouts(20);
            const filtered = recents.filter(
                (w) => w.ended_at !== null && w.id !== excludeWorkoutId,
            );
            setRows(filtered.map((w) => {
                const exercises = getExercisesForWorkout(w.id);
                const muscleGroups = [...new Set(
                    exercises
                        .map((e) => e.exerciseTemplate?.muscle_group)
                        .filter((g): g is string => !!g),
                )];
                return {
                    workout: w,
                    exerciseCount: exercises.length,
                    muscleGroups,
                };
            }));
        });
    }, [excludeWorkoutId]);

    function handleCopy(sourceId: number) {
        if (excludeWorkoutId == null) return;
        copyWorkoutAsScheduled(sourceId, excludeWorkoutId);
        onCopied?.();
    }

    function formatDate(dateStr: string): string {
        const [y, m, d] = dateStr.split("-");
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        return dateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }

    if (rows.length === 0) {
        return (
            <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{t("exercise.copyWorkout.noWorkouts")}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.subtitle}>{t("exercise.copyWorkout.recentHeader")}</Text>
            <FlatList
                data={rows}
                keyExtractor={(item) => String(item.workout.id)}
                renderItem={({ item }) => (
                    <Pressable
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        onPress={() => handleCopy(item.workout.id)}
                    >
                        <Text style={styles.rowDate}>{formatDate(item.workout.date)}</Text>
                        <View style={styles.rowCenter}>
                            <Text style={styles.rowTitle} numberOfLines={1}>
                                {item.workout.title || t("exercise.workout.defaultTitle")}
                            </Text>
                            <Text style={styles.rowMeta}>
                                {t("exercise.copyWorkout.exercises", { count: item.exerciseCount })}
                            </Text>
                        </View>
                        <View style={styles.dots}>
                            {item.muscleGroups.map((group) => (
                                <View
                                    key={group}
                                    style={[styles.dot, { backgroundColor: getMuscleGroupColor(group, colors) }]}
                                />
                            ))}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </Pressable>
                )}
                style={styles.list}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            width: "100%",
        },
        subtitle: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        list: {
            width: "100%",
        },
        listContent: {
            paddingBottom: spacing.sm,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
        },
        rowPressed: {
            opacity: 0.7,
        },
        rowDate: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            width: 70,
        },
        rowCenter: {
            flex: 1,
        },
        rowTitle: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
        },
        rowMeta: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            marginTop: 2,
        },
        dots: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
            justifyContent: "flex-end",
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        emptyWrap: {
            alignItems: "center",
            paddingVertical: spacing.md,
        },
        emptyText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            textAlign: "center",
        },
    });
}

const MUSCLE_GROUP_COLOR_MAP: Partial<Record<string, keyof ThemeColors>> = {
    chest: "exerciseChest",
    back: "exerciseBack",
    legs: "exerciseLegs",
    shoulders: "exerciseShoulders",
    arms: "exerciseArms",
    core: "exerciseCore",
    full_body: "exerciseFullBody",
};

function getMuscleGroupColor(muscleGroup: string, colors: ThemeColors): string {
    const key = MUSCLE_GROUP_COLOR_MAP[muscleGroup];
    return key ? colors[key] : colors.exercise;
}
