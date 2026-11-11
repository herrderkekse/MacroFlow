import {
    deleteWorkout,
    getExercisesForWorkout,
    getWorkoutsByDate,
    type Workout,
    type WorkoutExerciseWithSets,
} from "@/src/features/exercise/services/exerciseDb";
import IconButton from "@/src/shared/atoms/IconButton";
import SectionCard from "@/src/shared/components/SectionCard";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { formatSetSummary } from "../helpers/workoutSummary";

interface WorkoutSummaryProps {
    workout: Workout;
    exercises: WorkoutExerciseWithSets[];
    onDelete: () => void;
    isFirst: boolean;
}

function WorkoutSummaryCard({ workout, exercises, onDelete, isFirst }: WorkoutSummaryProps) {
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
        <Pressable
            style={({ pressed }) => [styles.card, !isFirst && styles.cardDivider, pressed && styles.pressed]}
            onPress={handlePress}
            accessibilityRole="button"
        >
            <View style={styles.cardHeader}>
                <View style={styles.cardTitleBlock}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                        {workout.title || t("exercise.workout.defaultTitle")}
                    </Text>
                    {durationMinutes !== null && (
                        <Text style={styles.cardDuration}>
                            {t("exercise.workoutSummary.duration", { minutes: durationMinutes })}
                        </Text>
                    )}
                </View>
                <IconButton
                    icon="trash-outline"
                    size="sm"
                    color={colors.textTertiary}
                    label={t("common.delete")}
                    onPress={onDelete}
                />
            </View>
            {exercises.slice(0, 5).map((ex) => (
                <View key={ex.workoutExercise.id} style={styles.exerciseLine}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                        {ex.exerciseTemplate?.name ?? "?"}
                    </Text>
                    <Text style={styles.exerciseSummary} numberOfLines={1}>
                        {formatSetSummary(ex.sets)}
                    </Text>
                </View>
            ))}
            {exercises.length > 5 && (
                <Text style={styles.moreText}>
                    {t("exercise.workoutSummary.moreExercises", { count: exercises.length - 5 })}
                </Text>
            )}
        </Pressable>
    );
}

interface WorkoutSummarySectionProps {
    date: string;
    refreshKey?: number;
    onQuickAdd?: () => void;
    hideWhenEmpty?: boolean;
}

export default function WorkoutSummarySection({ date, refreshKey, onQuickAdd, hideWhenEmpty = false }: WorkoutSummarySectionProps) {
    const { t } = useTranslation();
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
        queueMicrotask(load);
    }, [load, refreshKey]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

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
        router.push({ pathname: "/workout", params: { date } });
    }

    if (hideWhenEmpty && workoutsData.length === 0) {
        return null;
    }

    return (
        <SectionCard
            icon="barbell-outline"
            title={t("exercise.workoutSummary.title")}
            onAdd={handleStartWorkout}
            addLabel={t("exercise.workoutSummary.startWorkout")}
            actions={
                onQuickAdd ? (
                    <IconButton
                        icon="flash-outline"
                        size="sm"
                        label={t("exercise.workoutSummary.quickAdd")}
                        onPress={onQuickAdd}
                    />
                ) : undefined
            }
        >
            {workoutsData.map(({ workout, exercises }, index) => (
                <WorkoutSummaryCard
                    key={workout.id}
                    workout={workout}
                    exercises={exercises}
                    onDelete={() => handleDelete(workout.id)}
                    isFirst={index === 0}
                />
            ))}
        </SectionCard>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: { paddingVertical: spacing.sm + 2 },
        cardDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed: { opacity: 0.6 },
        cardHeader: { flexDirection: "row", alignItems: "center", marginRight: -spacing.xs },
        cardTitleBlock: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
        cardTitle: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        cardDuration: { fontSize: fontSize.xs, color: colors.textSecondary },
        exerciseLine: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, paddingVertical: 2 },
        exerciseName: { flexShrink: 1, fontSize: fontSize.xs, color: colors.textSecondary },
        exerciseSummary: { fontSize: fontSize.xs, color: colors.textTertiary, fontVariant: ["tabular-nums"] },
        moreText: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
    });
}
