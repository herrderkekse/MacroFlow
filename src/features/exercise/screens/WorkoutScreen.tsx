import IconButton from "@/src/shared/atoms/IconButton";
import EmptyState from "@/src/shared/atoms/EmptyState";
import ActionSheet from "@/src/shared/components/ActionSheet";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SectionHeader from "@/src/shared/components/SectionHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { parseDateKey } from "@/src/utils/date";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, UIManager, View } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import AddExerciseSheet from "../components/AddExerciseSheet";
import ExerciseCard from "../components/ExerciseCard";
import HistoricalWorkoutList from "../components/HistoricalWorkoutList";
import SetVideoProvider from "../components/SetVideoProvider";
import SupersetCard from "../components/SupersetCard";
import WorkoutFooter from "../components/WorkoutFooter";
import WorkoutKeepAwake from "../components/WorkoutKeepAwake";
import WorkoutMenu from "../components/WorkoutMenu";
import WorkoutStatusCard from "../components/WorkoutStatusCard";
import { groupIntoCards, type WorkoutCard } from "../helpers/supersets";
import { countSets, workoutSubtitle } from "../helpers/workoutStatus";
import { resetDurationClock, useDurationTimerAlarm } from "../hooks/useDurationClock";
import { useRestTimer } from "../hooks/useRestTimer";
import { useStatusPage } from "../hooks/useStatusPage";
import { useWorkout } from "../hooks/useWorkout";
import { useWorkoutActions } from "../hooks/useWorkoutActions";
import { copySetsFromLastSession, deleteWorkout, type ExerciseTemplate } from "../services/exerciseDb";
import { createWorkoutScreenStyles } from "./WorkoutScreenStyles";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WorkoutScreen() {
    const colors = useThemeColors();
    const { t, i18n } = useTranslation();
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
    useDurationTimerAlarm();
    const actions = useWorkoutActions(workout, restTimer);
    const keepAwakeInWorkout = useAppStore((s) => s.keepAwakeInWorkout);
    const workoutData = workout.data;
    const reloadWorkout = workout.reload;
    // The rest timer and duration clock are persisted across app restarts, so a finished workout must end them.
    const finishCurrentWorkout = () => {
        if (workout.finishCurrentWorkout()) {
            restTimer.skip();
            resetDurationClock();
        }
    };
    const [showAddExercise, setShowAddExercise] = useState(false);
    // Set while the add-exercise sheet is picking the second exercise for a superset (base's id).
    const [supersetBaseId, setSupersetBaseId] = useState<number | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showLeaveSheet, setShowLeaveSheet] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
        const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

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

    function handleDiscard() {
        if (!workoutData) return;
        if (!isFinished) {
            restTimer.skip();
            resetDurationClock();
        }
        deleteWorkout(workoutData.workout.id);
        router.back();
    }

    const handleBack = useCallback(() => {
        const isInProgress = workoutData?.workout && !workoutData.workout.ended_at;
        if (!isInProgress) { router.back(); return; }

        setShowLeaveSheet(true);
    }, [router, workoutData]);

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
    const status = useStatusPage({
        exercises, expandedId, isLive: !isFinished,
        restStartedAt: restTimer.startedAtEpoch, restRunning: restTimer.isRunning, restOver: restTimer.isTargetReached,
    });
    const showClock = status.setPage;
    const sets = useMemo(() => countSets(exercises), [exercises]);

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
        const isExpanded = item.members.some((m) => m.workoutExercise.id === expandedId);
        const wrapStyle = isActive ? styles.draggingCard : undefined;
        const shared = {
            index,
            isFinished,
            isExpanded,
            onDragStart: drag,
            onRemove: workout.removeExercise,
            onNoteChange: actions.handleNoteChange,
            onConfirmSet: actions.handleConfirmSet,
            onUpdateSet: actions.handleUpdateSet,
            onDeleteSet: actions.handleDeleteSet,
            onSetTypeChange: actions.handleSetTypeChange,
            onAddSet: actions.handleAddSet,
            onCopyFromLast: actions.handleCopyFromLast,
        };

        if (item.isSuperset) {
            return (
                <View style={wrapStyle}>
                    <SupersetCard
                        {...shared}
                        card={item}
                        onExpand={() => handleExpand(item.members[0].workoutExercise.id)}
                        getLastSets={getLastSets}
                        onReorderSet={actions.handleReorderSupersetSet}
                    />
                </View>
            );
        }

        const member = item.members[0];
        return (
            <View style={wrapStyle}>
                <ExerciseCard
                    {...shared}
                    item={member}
                    onExpand={() => handleExpand(member.workoutExercise.id)}
                    lastWorkoutSets={getLastSets(member.workoutExercise.exercise_template_id)}
                    onReorderSets={actions.handleReorderSets}
                    onSuperset={handleSuperset}
                    onShowClock={() => showClock("clock")}
                />
            </View>
        );
    }

    const title = workoutData?.workout.title || t("exercise.workout.defaultTitle");

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
            <Stack.Screen options={{ headerShown: false }} />
            <WorkoutKeepAwake enabled={keepAwakeInWorkout} />

            <ScreenHeader
                title={title}
                subtitle={workoutData
                    ? workoutSubtitle(workoutData.workout, workout.elapsedMs, exercises.length, t, i18n.language)
                    : undefined}
                onBack={handleBack}
                editableTitle={{
                    value: workoutData?.workout.title ?? "",
                    onChange: workout.updateTitle,
                    placeholder: t("exercise.workout.defaultTitle"),
                    label: t("exercise.workout.rename"),
                }}
                right={
                    <IconButton icon="ellipsis-horizontal" label={t("common.moreActions")} onPress={() => setShowMenu(true)} />
                }
            />

            <WorkoutStatusCard
                isLive={!isFinished}
                page={status.page}
                pages={status.pages}
                onPageChange={status.setPage}
                setsDone={sets.done}
                setsTotal={sets.total}
                rest={{
                    running: restTimer.isRunning,
                    elapsedSeconds: restTimer.elapsedSeconds,
                    targetSeconds: restTimer.isRunning ? restTimer.targetSeconds : restTimer.nextTargetSeconds,
                    onStart: () => restTimer.start(null, "working"),
                    onSkip: restTimer.skip,
                    onChangeDuration: restTimer.setDuration,
                }}
                clockExercise={status.clockExercise && {
                    id: status.clockExercise.workoutExercise.id,
                    name: status.clockExercise.exerciseTemplate?.name ?? "",
                }}
                onClockStart={() => { if (restTimer.isRunning) restTimer.skip(); }}
            />

            <SetVideoProvider>
                <DraggableFlatList
                    data={cards}
                    keyExtractor={(item) => item.key}
                    renderItem={renderCard}
                    contentContainerStyle={styles.list}
                    // Fill the screen, so the footer below sits at the bottom edge.
                    containerStyle={styles.listContainer}
                    activationDistance={0}
                    autoscrollThreshold={80}
                    autoscrollSpeed={180}
                    onDragBegin={() => setIsDragging(true)}
                    onDragEnd={handleDragEnd}
                    // "+ EXERCISES", like the recipe editor's "+ INGREDIENTS".
                    ListHeaderComponent={
                        <SectionHeader
                            title={t("exercise.workout.exercisesHeader")}
                            hint={exercises.length > 0 ? t("common.itemCount", { count: exercises.length }) : undefined}
                            onAdd={() => setShowAddExercise(true)}
                            addLabel={t("exercise.workout.addExercise")}
                            first
                        />
                    }
                    ListEmptyComponent={
                        <HistoricalWorkoutList
                            excludeWorkoutId={workout.data?.workout.id}
                            onCopied={workout.reload}
                            style={styles.emptyWrap}
                            emptyState={
                                <EmptyState icon="barbell-outline" title={t("exercise.workout.emptyState")} style={styles.empty} />
                            }
                        />
                    }
                />
            </SetVideoProvider>

            {/* Hidden while typing, so the keyboard leaves room for the sets. */}
            {!keyboardVisible && (
                <WorkoutFooter
                    isLive={!isFinished}
                    openSets={sets.total - sets.done}
                    onAddExercise={() => setShowAddExercise(true)}
                    onFinish={handleFinish}
                    onLeave={() => router.back()}
                />
            )}

            {workoutData?.workout && (
                <WorkoutMenu
                    visible={showMenu}
                    onClose={() => setShowMenu(false)}
                    workout={workoutData.workout}
                    onSaveTimes={handleSaveTimes}
                    onCopied={workout.reload}
                    onDiscard={handleDiscard}
                />
            )}

            {/* Leaving mid-workout: closing the sheet is "keep going". */}
            <ActionSheet
                visible={showLeaveSheet}
                onClose={() => setShowLeaveSheet(false)}
                title={t("exercise.workout.leaveTitle")}
                subtitle={t("exercise.workout.leaveMessage")}
                actions={[
                    {
                        key: "finish",
                        icon: "checkmark-done-outline",
                        label: t("exercise.workout.leaveFinish"),
                        onPress: () => { finishCurrentWorkout(); router.back(); },
                    },
                    {
                        key: "leave",
                        icon: "exit-outline",
                        label: t("exercise.workout.leaveWithout"),
                        onPress: () => router.back(),
                    },
                    {
                        key: "continue",
                        icon: "play-outline",
                        label: t("exercise.workout.leaveContinue"),
                        onPress: () => { },
                    },
                ]}
            />

            <AddExerciseSheet
                visible={showAddExercise}
                onClose={handleCloseAddExercise}
                onSelect={handleExerciseSelected}
            />
        </KeyboardAvoidingView>
    );
}
