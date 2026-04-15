import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { parseDateKey } from "@/src/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Alert, LayoutAnimation, Platform, Text, UIManager, View } from "react-native";
import AddExerciseModal from "../components/AddExerciseModal";
import CopyWorkoutSheet from "../components/CopyWorkoutSheet";
import ExerciseCard from "../components/ExerciseCard";
import WorkoutHeader from "../components/WorkoutHeader";
import { useRestTimer } from "../hooks/useRestTimer";
import { useWorkout } from "../hooks/useWorkout";
import { useWorkoutActions } from "../hooks/useWorkoutActions";
import { createWorkoutScreenStyles } from "./WorkoutScreenStyles";
import {
    copySetsFromLastSession, type ExerciseTemplate, type WorkoutExerciseWithSets,
} from "../services/exerciseDb";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WorkoutScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createWorkoutScreenStyles(colors), [colors]);
    const router = useRouter();
    const params = useLocalSearchParams<{ workoutId?: string; date?: string }>();
    const workoutId = params.workoutId ? Number(params.workoutId) : undefined;
    const workoutDate = params.date ? parseDateKey(params.date) : undefined;

    const workout = useWorkout({ workoutId, date: workoutDate });
    const restTimer = useRestTimer();
    const actions = useWorkoutActions(workout, restTimer);
    const [showAddExercise, setShowAddExercise] = useState(false);
    const [showCopySheet, setShowCopySheet] = useState(false);

    // Focus state: which exercise is expanded (null = none)
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!workout.data && !workoutId && !workout.isResumed) {
            workout.startWorkout(workoutDate);
        }
    }, [workout.data, workoutId, workout.isResumed, workout.startWorkout, workoutDate]);

    // Auto-expand the first exercise when data loads
    useEffect(() => {
        const exercises = workout.data?.exercises ?? [];
        if (exercises.length > 0 && expandedId === null) {
            setExpandedId(exercises[0].workoutExercise.id);
        }
    }, [workout.data?.exercises, expandedId]);

    const isFinished = !!workout.data?.workout.ended_at;
    const isEmpty = (workout.data?.exercises.length ?? 0) === 0;

    const handleExpand = useCallback((weId: number, index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(weId);
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index, animated: true, viewOffset: 8 });
        }, 100);
    }, []);

    function handleExerciseSelected(template: ExerciseTemplate) {
        const weId = workout.addExercise(template.id);
        if (weId) {
            copySetsFromLastSession(template.id, weId);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedId(weId);
        }
        workout.reload();
        setShowAddExercise(false);
    }

    function handleFinish() {
        workout.finishCurrentWorkout();
        router.back();
    }

    function handleBack() {
        const isInProgress = workout.data?.workout && !workout.data.workout.ended_at;
        if (!isInProgress) { router.back(); return; }

        Alert.alert(
            t("exercise.workout.leaveTitle"),
            t("exercise.workout.leaveMessage"),
            [
                { text: t("exercise.workout.leaveContinue"), style: "cancel" },
                { text: t("exercise.workout.leaveFinish"), onPress: () => { workout.finishCurrentWorkout(); router.back(); } },
                { text: t("exercise.workout.leaveWithout"), style: "destructive", onPress: () => router.back() },
            ],
        );
    }

    function renderExercise({ item, index }: { item: WorkoutExerciseWithSets; index: number }) {
        const tid = item.workoutExercise.exercise_template_id;
        const timerActive = restTimer.isRunning && restTimer.workoutExerciseId === item.workoutExercise.id;
        const isExpanded = expandedId === item.workoutExercise.id;
        return (
            <ExerciseCard
                item={item}
                index={index}
                totalExercises={workout.data?.exercises.length ?? 0}
                isFinished={isFinished}
                isExpanded={isExpanded}
                onExpand={() => handleExpand(item.workoutExercise.id, index)}
                lastWorkoutSets={tid ? (actions.lastSetsCache.get(tid) ?? []) : []}
                onRemove={workout.removeExercise}
                onMoveUp={actions.handleMoveUp}
                onMoveDown={actions.handleMoveDown}
                onNoteChange={actions.handleNoteChange}
                onConfirmSet={actions.handleConfirmSet}
                onUpdateSet={actions.handleUpdateSet}
                onDeleteSet={actions.handleDeleteSet}
                onSetTypeChange={actions.handleSetTypeChange}
                onAddSet={actions.handleAddSet}
                onCopyFromLast={actions.handleCopyFromLast}
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
                ref={flatListRef}
                data={workout.data?.exercises ?? []}
                keyExtractor={(item) => String(item.workoutExercise.id)}
                renderItem={renderExercise}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Ionicons name="barbell-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>{t("exercise.workout.emptyState")}</Text>
                        <Button
                            title={t("exercise.workout.addExercise")}
                            variant="outline"
                            icon={<Ionicons name="add" size={18} color={colors.text} />}
                            onPress={() => setShowAddExercise(true)}
                            style={styles.addBtn}
                        />
                        <Button
                            title={t("exercise.workout.copyFromHistory")}
                            variant="ghost"
                            icon={<Ionicons name="copy-outline" size={18} color={colors.primary} />}
                            onPress={() => setShowCopySheet(true)}
                        />
                    </View>
                }
                ListFooterComponent={
                    !isEmpty ? (
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
