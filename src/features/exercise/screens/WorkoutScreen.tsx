import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Alert, Text, View } from "react-native";
import AddExerciseModal from "../components/AddExerciseModal";
import CopyWorkoutSheet from "../components/CopyWorkoutSheet";
import ExerciseCard from "../components/ExerciseCard";
import type { SetValues } from "../components/SetInputRow";
import WorkoutHeader from "../components/WorkoutHeader";
import { useRestTimer } from "../hooks/useRestTimer";
import { useWorkout } from "../hooks/useWorkout";
import { createWorkoutScreenStyles } from "./WorkoutScreenStyles";
import {
    addSet, completeSet, copySetsFromLastSession, deleteSet, getLastCompletedSetsForTemplate, updateSet,
    updateWorkoutExercise, type ExerciseSet, type ExerciseTemplate, type WorkoutExerciseWithSets,
} from "../services/exerciseDb";

export default function WorkoutScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createWorkoutScreenStyles(colors), [colors]);
    const router = useRouter();
    const params = useLocalSearchParams<{ workoutId?: string }>();
    const workoutId = params.workoutId ? Number(params.workoutId) : undefined;

    const workout = useWorkout({ workoutId });
    const restTimer = useRestTimer();
    const [showAddExercise, setShowAddExercise] = useState(false);
    const [showCopySheet, setShowCopySheet] = useState(false);

    // Auto-start workout if none loaded (must run in effect, not during render)
    useEffect(() => {
        if (!workout.data && !workoutId && !workout.isResumed) {
            workout.startWorkout();
        }
    }, [workout.data, workoutId, workout.isResumed, workout.startWorkout]);

    const isFinished = !!workout.data?.workout.ended_at;
    const isEmpty = (workout.data?.exercises.length ?? 0) === 0;

    function handleExerciseSelected(template: ExerciseTemplate) {
        const weId = workout.addExercise(template.id);
        if (weId) copySetsFromLastSession(template.id, weId);
        workout.reload();
        setShowAddExercise(false);
    }

    function handleFinish() {
        workout.finishCurrentWorkout();
        router.back();
    }

    function handleBack() {
        const isInProgress = workout.data?.workout && !workout.data.workout.ended_at;
        if (!isInProgress) {
            router.back();
            return;
        }

        Alert.alert(
            t("exercise.workout.leaveTitle"),
            t("exercise.workout.leaveMessage"),
            [
                { text: t("exercise.workout.leaveContinue"), style: "cancel" },
                {
                    text: t("exercise.workout.leaveFinish"),
                    onPress: () => { workout.finishCurrentWorkout(); router.back(); },
                },
                {
                    text: t("exercise.workout.leaveWithout"),
                    style: "destructive",
                    onPress: () => router.back(),
                },
            ],
        );
    }

    function handleNoteChange(workoutExerciseId: number, note: string) {
        updateWorkoutExercise(workoutExerciseId, { notes: note || null });
        workout.reload();
    }

    function handleMoveUp(workoutExerciseId: number) {
        const exercises = workout.data?.exercises ?? [];
        const idx = exercises.findIndex((e) => e.workoutExercise.id === workoutExerciseId);
        if (idx > 0) {
            workout.moveExercise(workoutExerciseId, idx);
        }
    }

    function handleMoveDown(workoutExerciseId: number) {
        const exercises = workout.data?.exercises ?? [];
        const idx = exercises.findIndex((e) => e.workoutExercise.id === workoutExerciseId);
        if (idx < exercises.length - 1) {
            workout.moveExercise(workoutExerciseId, idx + 2);
        }
    }

    const handleConfirmSet = useCallback((setId: number, values: SetValues) => {
        updateSet(setId, {
            weight: values.weight,
            weight_unit: values.weight_unit,
            reps: values.reps,
            rir: values.rir,
            duration_seconds: values.duration_seconds,
            distance_meters: values.distance_meters,
            type: values.type,
        });
        completeSet(setId);

        // Find which workout exercise this set belongs to & start rest timer
        for (const ex of workout.data?.exercises ?? []) {
            if (ex.sets.some((s) => s.id === setId)) {
                restTimer.start(ex.workoutExercise.id, values.type);
                break;
            }
        }

        workout.reload();
    }, [workout, restTimer]);

    const handleDeleteSet = useCallback((setId: number) => {
        deleteSet(setId);
        workout.reload();
    }, [workout]);

    const handleSetTypeChange = useCallback((setId: number, type: string) => {
        updateSet(setId, { type });
        workout.reload();
    }, [workout]);

    const handleAddSet = useCallback((workoutExerciseId: number) => {
        const ex = workout.data?.exercises.find((e) => e.workoutExercise.id === workoutExerciseId);
        const defaultUnit = ex?.exerciseTemplate?.default_weight_unit ?? "kg";
        addSet({ workout_exercise_id: workoutExerciseId, weight_unit: defaultUnit });
        workout.reload();
    }, [workout]);

    const handleCopyFromLast = useCallback((workoutExerciseId: number, templateId: number) => {
        const count = copySetsFromLastSession(templateId, workoutExerciseId);
        if (count === 0) {
            Alert.alert(t("exercise.exerciseCard.noHistory"));
        }
        workout.reload();
    }, [workout, t]);

    /** Cache of last-workout sets per template. */
    const lastSetsCache = useMemo(() => {
        const cache = new Map<number, ExerciseSet[]>();
        for (const ex of workout.data?.exercises ?? []) {
            const tid = ex.workoutExercise.exercise_template_id;
            if (tid && !cache.has(tid)) {
                cache.set(tid, getLastCompletedSetsForTemplate(tid));
            }
        }
        return cache;
    }, [workout.data?.exercises]);

    function renderExercise({ item, index }: { item: WorkoutExerciseWithSets; index: number }) {
        const tid = item.workoutExercise.exercise_template_id;
        const timerActive = restTimer.isRunning && restTimer.workoutExerciseId === item.workoutExercise.id;
        return (
            <ExerciseCard
                item={item}
                index={index}
                totalExercises={workout.data?.exercises.length ?? 0}
                isFinished={isFinished}
                lastWorkoutSets={tid ? (lastSetsCache.get(tid) ?? []) : []}
                onRemove={workout.removeExercise}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onNoteChange={handleNoteChange}
                onConfirmSet={handleConfirmSet}
                onDeleteSet={handleDeleteSet}
                onSetTypeChange={handleSetTypeChange}
                onAddSet={handleAddSet}
                onCopyFromLast={handleCopyFromLast}
                restTimerActive={timerActive}
                restTimerElapsed={timerActive ? restTimer.elapsedSeconds : 0}
                restTimerTarget={timerActive ? restTimer.targetSeconds : 0}
                restTimerReached={timerActive ? restTimer.isTargetReached : false}
                onRestTimerSkip={restTimer.skip}
            />
        );
    }

    return (
        <View style={styles.screen}>
            <Stack.Screen options={{ headerShown: false }} />

            <WorkoutHeader
                title={workout.data?.workout.title || t("exercise.workout.defaultTitle")}
                elapsedMs={workout.elapsedMs}
                isFinished={isFinished}
                hasUnfinishedSets={workout.hasUnfinishedSets}
                onTitleChange={workout.updateTitle}
                onFinish={handleFinish}
                onBack={handleBack}
            />

            <FlatList
                data={workout.data?.exercises ?? []}
                keyExtractor={(item) => String(item.workoutExercise.id)}
                renderItem={renderExercise}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Ionicons name="barbell-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>{t("exercise.workout.emptyState")}</Text>
                        {!isFinished && (
                            <Button
                                title={t("exercise.workout.copyFromHistory")}
                                variant="ghost"
                                icon={<Ionicons name="copy-outline" size={18} color={colors.primary} />}
                                onPress={() => setShowCopySheet(true)}
                            />
                        )}
                    </View>
                }
                ListFooterComponent={
                    !isFinished && !isEmpty ? (
                        <Button
                            title={t("exercise.workout.addExercise")}
                            variant="outline"
                            icon={<Ionicons name="add" size={18} color={colors.text} />}
                            onPress={() => setShowAddExercise(true)}
                            style={styles.addBtn}
                        />
                    ) : null
                }
            />

            <AddExerciseModal
                visible={showAddExercise}
                onClose={() => setShowAddExercise(false)}
                onSelect={handleExerciseSelected}
            />

            {workout.data?.workout.id && (
                <CopyWorkoutSheet
                    visible={showCopySheet}
                    targetWorkoutId={workout.data.workout.id}
                    onClose={() => setShowCopySheet(false)}
                    onCopied={workout.reload}
                />
            )}
        </View>
    );
}
