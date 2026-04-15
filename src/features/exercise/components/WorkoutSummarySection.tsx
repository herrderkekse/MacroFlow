import {
    deleteWorkout,
    getExercisesForWorkout,
    getWorkoutsByDate,
    type Workout,
    type WorkoutExerciseWithSets,
} from "@/src/features/exercise/services/exerciseDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { formatSetSummary } from "../helpers/workoutSummary";

interface WorkoutSummaryProps {
    workout: Workout;
    exercises: WorkoutExerciseWithSets[];
    onDelete: () => void;
}

function WorkoutSummaryCard({ workout, exercises, onDelete }: WorkoutSummaryProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();

    const durationMinutes = workout.ended_at && workout.started_at
        ? Math.round((workout.ended_at - workout.started_at) / 60_000)
        : null;

    function handlePress() {
        router.push({ pathname: "/workout", params: { workoutId: String(workout.id) } });
    }

    return (
        <Pressable style={styles.card} onPress={handlePress}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                    {workout.title || t("exercise.workout.defaultTitle")}
                </Text>
                {durationMinutes !== null && (
                    <Text style={styles.cardDuration}>
                        {t("exercise.workoutSummary.duration", { minutes: durationMinutes })}
                    </Text>
                )}
                <Pressable onPress={handlePress} hitSlop={8}>
                    <Ionicons name="create-outline" size={18} color={colors.textTertiary} />
                </Pressable>
                <Pressable onPress={onDelete} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                </Pressable>
            </View>
            {exercises.slice(0, 5).map((ex) => (
                <Text key={ex.workoutExercise.id} style={styles.exerciseLine} numberOfLines={1}>
                    {ex.exerciseTemplate?.name ?? "?"}{"  "}
                    <Text style={styles.exerciseSummary}>
                        {formatSetSummary(ex.sets)}
                    </Text>
                </Text>
            ))}
            {exercises.length > 5 && (
                <Text style={styles.moreText}>
                    +{exercises.length - 5} more
                </Text>
            )}
        </Pressable>
    );
}

interface WorkoutSummarySectionProps {
    date: string;
    refreshKey?: number;
    onQuickAdd?: () => void;
}

export default function WorkoutSummarySection({ date, refreshKey, onQuickAdd }: WorkoutSummarySectionProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();

    const [workoutsData, setWorkoutsData] = useState<
        { workout: Workout; exercises: WorkoutExerciseWithSets[] }[]
    >([]);

    const load = useCallback(() => {
        const ws = getWorkoutsByDate(date);
        setWorkoutsData(
            ws.map((w) => ({ workout: w, exercises: getExercisesForWorkout(w.id) })),
        );
    }, [date]);

    useEffect(() => {
        load();
    }, [load, refreshKey]);

    function handleDelete(workoutId: number) {
        Alert.alert(
            t("common.delete"),
            t("exercise.workoutSummary.deleteConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: () => {
                        deleteWorkout(workoutId);
                        load();
                    },
                },
            ],
        );
    }

    function handleStartWorkout() {
        router.push("/workout");
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="barbell-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.headerLabel}>
                    {t("exercise.workoutSummary.title")}
                </Text>
                <Pressable onPress={handleStartWorkout} hitSlop={8}>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </Pressable>
                {onQuickAdd && (
                    <Pressable onPress={onQuickAdd} hitSlop={8}>
                        <Ionicons name="flash-outline" size={22} color={colors.primary} />
                    </Pressable>
                )}
            </View>

            {workoutsData.length === 0 ? (
                <Text style={styles.empty}>
                    {t("exercise.workoutSummary.noWorkouts")}
                </Text>
            ) : (
                workoutsData.map(({ workout, exercises }) => (
                    <WorkoutSummaryCard
                        key={workout.id}
                        workout={workout}
                        exercises={exercises}
                        onDelete={() => handleDelete(workout.id)}
                    />
                ))
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        headerLabel: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        empty: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            paddingVertical: spacing.sm,
            marginTop: spacing.sm,
        },
        card: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
        },
        cardHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.xs,
        },
        cardTitle: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
        },
        cardDuration: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
        },
        exerciseLine: {
            fontSize: fontSize.xs,
            color: colors.text,
            paddingLeft: spacing.sm,
            marginTop: 2,
        },
        exerciseSummary: {
            color: colors.textSecondary,
        },
        moreText: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            paddingLeft: spacing.sm,
            marginTop: 2,
        },
    });
}
