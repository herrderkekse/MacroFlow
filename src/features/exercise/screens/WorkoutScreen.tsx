import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { parseDateKey } from "@/src/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, KeyboardAvoidingView, LayoutAnimation, Platform, Text, UIManager, View } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import AddExerciseModal from "../components/AddExerciseModal";
import EditWorkoutTimesModal from "../components/EditWorkoutTimesModal";
import ExerciseCard from "../components/ExerciseCard";
import HistoricalWorkoutList from "../components/HistoricalWorkoutList";
import SupersetCard from "../components/SupersetCard";
import WorkoutHeader from "../components/WorkoutHeader";
import WorkoutKeepAwake from "../components/WorkoutKeepAwake";
import { groupIntoCards, type WorkoutCard } from "../helpers/supersets";
import { useRestTimer } from "../hooks/useRestTimer";
import { useWorkout } from "../hooks/useWorkout";
import { useWorkoutActions } from "../hooks/useWorkoutActions";
import {
    copySetsFromLastSession, type ExerciseTemplate,
} from "../services/exerciseDb";
import { createWorkoutScreenStyles } from "./WorkoutScreenStyles";

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
    const workoutDate = useMemo(
        () => (params.date ? parseDateKey(params.date) : undefined),
        [params.date]
    );

    const workout = useWorkout({ workoutId, date: workoutDate });
    const restTimer = useRestTimer();
    const actions = useWorkoutActions(workout, restTimer);
    const keepAwakeInWorkout = useAppStore((s) => s.keepAwakeInWorkout);
    const workoutData = workout.data;
    const reloadWorkout = workout.reload;
    const finishCurrentWorkout = workout.finishCurrentWorkout;
    const [showAddExercise, setShowAddExercise] = useState(false);
    // Set while the add-exercise sheet is picking the second exercise for a superset (base's id).
    const [supersetBaseId, setSupersetBaseId] = useState<number | null>(null);
    const [showTimesModal, setShowTimesModal] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Focus state: which exercise is expanded (null = none)
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        if (!workout.data && !workoutId && !workout.isResumed) {
            workout.startWorkout(workoutDate);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workout.data, workoutId, workout.isResumed, workout.startWorkout, workoutDate]);

    // Auto-expand the first exercise that still has an unfinished set when data loads
    useEffect(() => {
        const exercises = workout.data?.exercises ?? [];
        if (exercises.length > 0 && expandedId === null) {
            const targetIndex = exercises.findIndex((ex) => ex.sets.some((s) => !s.completed_at));
            queueMicrotask(() => setExpandedId(exercises[targetIndex === -1 ? 0 : targetIndex].workoutExercise.id));
        }
    }, [workout.data?.exercises, expandedId]);

    const isFinished = !!workout.data?.workout.ended_at;
    const isEmpty = (workout.data?.exercises.length ?? 0) === 0;

    const handleExpand = useCallback((weId: number) => {
        if (isDragging) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(weId);
    }, [isDragging]);

    function handleExerciseSelected(template: ExerciseTemplate, copyFromLast: boolean) {
        const weId = supersetBaseId != null
            ? workout.supersetExercise(supersetBaseId, template.id)
            : workout.addExercise(template.id);
        if (weId) {
            if (copyFromLast) {
                copySetsFromLastSession(template.id, weId);
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            // Keep the base expanded when supersetting so the combined card stays open.
            setExpandedId(supersetBaseId ?? weId);
        }
        workout.reload();
        setShowAddExercise(false);
        setSupersetBaseId(null);
    }

    function handleCloseAddExercise() {
        setShowAddExercise(false);
        setSupersetBaseId(null);
    }

    const handleSuperset = useCallback((baseWorkoutExerciseId: number) => {
        setSupersetBaseId(baseWorkoutExerciseId);
        setShowAddExercise(true);
    }, []);

    function handleFinish() {
        finishCurrentWorkout();
        router.back();
    }

    function handleSaveTimes(startEpoch: number, endEpoch: number | null) {
        workout.updateStartTime(startEpoch);
        if (endEpoch != null) workout.updateEndTime(endEpoch);
    }

    const handleBack = useCallback(() => {
        const isInProgress = workoutData?.workout && !workoutData.workout.ended_at;
        if (!isInProgress) { router.back(); return; }

        Alert.alert(
            t("exercise.workout.leaveTitle"),
            t("exercise.workout.leaveMessage"),
            [
                { text: t("exercise.workout.leaveContinue"), style: "cancel" },
                { text: t("exercise.workout.leaveFinish"), onPress: () => { finishCurrentWorkout(); router.back(); } },
                { text: t("exercise.workout.leaveWithout"), style: "destructive", onPress: () => router.back() },
            ],
        );
    }, [finishCurrentWorkout, router, t, workoutData]);

    useFocusEffect(
        useCallback(() => {
            reloadWorkout();
        }, [reloadWorkout]),
    );

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
                handleBack();
                return true;
            });
            return () => subscription.remove();
        }, [handleBack]),
    );

    const exercises = useMemo(
        () => workout.data?.exercises ?? [],
        [workout.data?.exercises],
    );

    const cards = useMemo(() => groupIntoCards(exercises), [exercises]);

    const getLastSets = useCallback(
        (templateId: number | null) => (templateId ? (actions.lastSetsCache.get(templateId) ?? []) : []),
        [actions.lastSetsCache],
    );

    const handleDragEnd = useCallback(({ from, to }: { from: number; to: number }) => {
        setIsDragging(false);
        if (from === to) return;
        const reordered = [...cards];
        const [moved] = reordered.splice(from, 1);
        if (!moved) return;
        reordered.splice(to, 0, moved);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        workout.reorderCards(reordered.flatMap((c) => c.members.map((m) => m.workoutExercise.id)));
    }, [cards, workout]);

    function renderCard({ item, drag, isActive, getIndex }: RenderItemParams<WorkoutCard>) {
        const index = getIndex() ?? 0;
        const timerActive = restTimer.isRunning;
        const isExpanded = item.members.some((m) => m.workoutExercise.id === expandedId);
        const wrapStyle = isActive ? styles.draggingCard : undefined;

        if (item.isSuperset) {
            return (
                <View style={wrapStyle}>
                    <SupersetCard
                        card={item}
                        index={index}
                        isFinished={isFinished}
                        isExpanded={isExpanded}
                        onExpand={() => handleExpand(item.members[0].workoutExercise.id)}
                        onDragStart={drag}
                        getLastSets={getLastSets}
                        onRemove={workout.removeExercise}
                        onNoteChange={actions.handleNoteChange}
                        onConfirmSet={actions.handleConfirmSet}
                        onUpdateSet={actions.handleUpdateSet}
                        onDeleteSet={actions.handleDeleteSet}
                        onSetTypeChange={actions.handleSetTypeChange}
                        onAddSet={actions.handleAddSet}
                        onCopyFromLast={actions.handleCopyFromLast}
                        onReorderSet={actions.handleReorderSupersetSet}
                        restTimerActive={timerActive}
                        restTimerElapsed={timerActive ? restTimer.elapsedSeconds : 0}
                        restTimerTarget={timerActive ? restTimer.targetSeconds : 0}
                        restTimerReached={timerActive ? restTimer.isTargetReached : false}
                        onRestTimerSkip={restTimer.skip}
                        onRestTimerChangeDuration={restTimer.setDuration}
                    />
                </View>
            );
        }

        const member = item.members[0];
        const tid = member.workoutExercise.exercise_template_id;
        return (
            <View style={wrapStyle}>
                <ExerciseCard
                    item={member}
                    index={index}
                    isFinished={isFinished}
                    isExpanded={isExpanded}
                    onExpand={() => handleExpand(member.workoutExercise.id)}
                    onDragStart={drag}
                    lastWorkoutSets={tid ? (actions.lastSetsCache.get(tid) ?? []) : []}
                    onRemove={workout.removeExercise}
                    onNoteChange={actions.handleNoteChange}
                    onConfirmSet={actions.handleConfirmSet}
                    onUpdateSet={actions.handleUpdateSet}
                    onDeleteSet={actions.handleDeleteSet}
                    onSetTypeChange={actions.handleSetTypeChange}
                    onAddSet={actions.handleAddSet}
                    onCopyFromLast={actions.handleCopyFromLast}
                    onReorderSets={actions.handleReorderSets}
                    onSuperset={handleSuperset}
                    restTimerActive={timerActive}
                    restTimerElapsed={timerActive ? restTimer.elapsedSeconds : 0}
                    restTimerTarget={timerActive ? restTimer.targetSeconds : 0}
                    restTimerReached={timerActive ? restTimer.isTargetReached : false}
                    onRestTimerSkip={restTimer.skip}
                    onRestTimerChangeDuration={restTimer.setDuration}
                />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
            <Stack.Screen options={{ headerShown: false }} />
            <WorkoutKeepAwake enabled={keepAwakeInWorkout} />

            <WorkoutHeader
                title={workout.data?.workout.title || t("exercise.workout.defaultTitle")}
                elapsedMs={workout.elapsedMs}
                isFinished={isFinished}
                hasUnfinishedSets={workout.hasUnfinishedSets}
                onTitleChange={workout.updateTitle}
                onFinish={handleFinish}
                onBack={handleBack}
                onTimerPress={() => setShowTimesModal(true)}
            />

            <DraggableFlatList
                data={cards}
                keyExtractor={(item) => item.key}
                renderItem={renderCard}
                contentContainerStyle={styles.list}
                activationDistance={0}
                autoscrollThreshold={80}
                autoscrollSpeed={180}
                onDragBegin={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
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
                        <HistoricalWorkoutList
                            excludeWorkoutId={workout.data?.workout.id}
                            onCopied={workout.reload}
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
                onClose={handleCloseAddExercise}
                onSelect={handleExerciseSelected}
            />

            {workout.data?.workout && (
                <EditWorkoutTimesModal
                    visible={showTimesModal}
                    onClose={() => setShowTimesModal(false)}
                    startedAt={workout.data.workout.started_at}
                    endedAt={workout.data.workout.ended_at}
                    onSave={handleSaveTimes}
                    labels={{
                        title: t("exercise.workout.editTimes"),
                        startLabel: t("exercise.workout.startedAt"),
                        endLabel: t("exercise.workout.endedAt"),
                        save: t("common.save"),
                    }}
                />
            )}
        </KeyboardAvoidingView>
    );
}
