import {
    deleteWorkout,
    getExercisesForWorkout,
    getWorkoutsByDate,
    type Workout,
    type WorkoutExerciseWithSets,
} from "@/src/features/exercise/services/exerciseDb";
import SectionCard from "@/src/shared/components/SectionCard";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

interface WorkoutRowProps {
    workout: Workout;
    exercises: WorkoutExerciseWithSets[];
    onDelete: () => void;
    isFirst: boolean;
}

/** One workout: its name, then exercises, sets and duration. Opens it; long-press deletes it. */
function WorkoutRow({ workout, exercises, onDelete, isFirst }: WorkoutRowProps) {
    const colors = useThemeColors();
    const { t, i18n } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();

    const sets = exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.completed_at).length, 0);
    const durationMinutes = workout.ended_at && workout.started_at
        ? Math.round((workout.ended_at - workout.started_at) / 60_000)
        : null;
    const detail = [
        t("exercise.workoutSummary.exerciseCount", { count: exercises.length }),
        t("exercise.workoutSummary.setCount", { count: sets }),
        durationMinutes !== null ? t("exercise.workoutSummary.duration", { minutes: durationMinutes }) : null,
        workout.ended_at
            ? t("exercise.workoutSummary.finishedAt", {
                time: new Date(workout.ended_at).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }),
            })
            : t("exercise.workoutSummary.inProgress"),
    ].filter(Boolean).join(" · ");

    return (
        <Pressable
            style={({ pressed }) => [styles.row, !isFirst && styles.divider, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/workout", params: { workoutId: String(workout.id) } })}
            onLongPress={onDelete}
            accessibilityRole="button"
            accessibilityHint={t("exercise.workoutSummary.deleteHint")}
        >
            <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>
                    {workout.title || t("exercise.workout.defaultTitle")}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
    );
}

interface WorkoutSummarySectionProps {
    date: string;
    refreshKey?: number;
    /** Adds a single exercise to the day without opening a workout. */
    onQuickAdd?: () => void;
}

/** The day's training: "+ TRAINING" starts a workout, each row opens one. Hidden on days without one. */
export default function WorkoutSummarySection({ date, refreshKey, onQuickAdd }: WorkoutSummarySectionProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();

    const [workoutsData, setWorkoutsData] = useState<
        { workout: Workout; exercises: WorkoutExerciseWithSets[] }[]
    >([]);

    const load = useCallback(() => {
        const ws = getWorkoutsByDate(date);
        setWorkoutsData(ws.map((w) => ({ workout: w, exercises: getExercisesForWorkout(w.id) })));
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
        Alert.alert(t("common.delete"), t("exercise.workoutSummary.deleteConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("common.delete"),
                style: "destructive",
                onPress: () => {
                    deleteWorkout(workoutId);
                    load();
                },
            },
        ]);
    }

    // Training is not an every-day thing; the section only appears once there is a workout.
    if (workoutsData.length === 0) return null;

    return (
        <SectionCard
            title={t("exercise.workoutSummary.title")}
            onAdd={() => router.push({ pathname: "/workout", params: { date } })}
            addLabel={t("exercise.workoutSummary.startWorkout")}
            aside={
                onQuickAdd ? (
                    <Pressable
                        onPress={onQuickAdd}
                        hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }}
                        style={({ pressed }) => [styles.quickAdd, pressed && styles.quickAddPressed]}
                        accessibilityRole="button"
                    >
                        <Ionicons name="flash-outline" size={13} color={colors.textSecondary} />
                        <Text style={styles.quickAddText}>{t("exercise.workoutSummary.quickAdd")}</Text>
                    </Pressable>
                ) : undefined
            }
        >
            {workoutsData.map(({ workout, exercises }, index) => (
                <WorkoutRow
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
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 4,
            paddingVertical: spacing.md - 1,
            paddingHorizontal: spacing.md,
        },
        divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed: { backgroundColor: colors.surfaceMuted },
        info: { flex: 1, minWidth: 0 },
        title: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        detail: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
        quickAdd: { flexDirection: "row", alignItems: "center", gap: 4 },
        quickAddPressed: { opacity: 0.6 },
        quickAddText: { fontSize: fontSize.xxs, fontWeight: "500", color: colors.textSecondary },
    });
}
