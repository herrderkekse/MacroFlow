import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { bestSetSummary, createCollapsedCardStyles } from "./ExerciseCardHelpers";
import { ExpandedExerciseCard } from "./ExpandedExerciseCard";
import type { SetValues } from "./SetInputRow";

const DRAG_ACTIVATION_LONG_PRESS_MS = 250;
const EXERCISE_DRAG_STEP_PX = 56;

interface ExerciseCardProps {
    item: WorkoutExerciseWithSets;
    index: number;
    totalExercises: number;
    isFinished: boolean;
    isExpanded: boolean;
    onExpand: () => void;
    lastWorkoutSets: ExerciseSet[];
    onRemove: (workoutExerciseId: number) => void;
    onMoveUp: (workoutExerciseId: number) => void;
    onMoveDown: (workoutExerciseId: number) => void;
    onMoveBySteps: (workoutExerciseId: number, steps: number) => void;
    onReorderSets: (sets: ExerciseSet[]) => void;
    onNoteChange: (workoutExerciseId: number, note: string) => void;
    onConfirmSet: (setId: number, values: SetValues) => void;
    onUpdateSet: (setId: number, values: SetValues) => void;
    onDeleteSet: (setId: number) => void;
    onSetTypeChange: (setId: number, type: string) => void;
    onAddSet: (workoutExerciseId: number) => void;
    onCopyFromLast: (workoutExerciseId: number, templateId: number) => void;
    restTimerActive: boolean;
    restTimerElapsed: number;
    restTimerTarget: number;
    restTimerReached: boolean;
    onRestTimerSkip: () => void;
}

export default function ExerciseCard({
    item, index, totalExercises, isFinished, isExpanded, onExpand, lastWorkoutSets,
    onRemove, onMoveUp, onMoveDown, onMoveBySteps, onReorderSets, onNoteChange,
    onConfirmSet, onUpdateSet, onDeleteSet, onSetTypeChange, onAddSet, onCopyFromLast,
    restTimerActive, restTimerElapsed, restTimerTarget, restTimerReached, onRestTimerSkip,
}: ExerciseCardProps) {
    const template = item.exerciseTemplate;
    const name = template?.name ?? "?";
    const exerciseType: ExerciseType = (template?.type as ExerciseType) ?? "weight";

    const [menuOpen, setMenuOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState(item.workoutExercise.notes ?? "");

    // Show collapsed card for non-expanded exercises
    if (!isExpanded) {
        return (
            <CollapsedExerciseCard
                item={item}
                index={index}
                name={name}
                isFinished={isFinished}
                onExpand={onExpand}
                onMoveBySteps={onMoveBySteps}
            />
        );
    }

    return (
        <ExpandedExerciseCard
            item={item}
            index={index}
            totalExercises={totalExercises}
            isFinished={isFinished}
            name={name}
            exerciseType={exerciseType}
            template={template}
            lastWorkoutSets={lastWorkoutSets}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            noteOpen={noteOpen}
            setNoteOpen={setNoteOpen}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            onRemove={onRemove}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onReorderSets={onReorderSets}
            onNoteChange={onNoteChange}
            onConfirmSet={onConfirmSet}
            onUpdateSet={onUpdateSet}
            onDeleteSet={onDeleteSet}
            onSetTypeChange={onSetTypeChange}
            onAddSet={onAddSet}
            onCopyFromLast={onCopyFromLast}
            restTimerActive={restTimerActive}
            restTimerElapsed={restTimerElapsed}
            restTimerTarget={restTimerTarget}
            restTimerReached={restTimerReached}
            onRestTimerSkip={onRestTimerSkip}
        />
    );
}

// ── Collapsed card ──────────────────────────────────────────────────────────

interface CollapsedProps {
    item: WorkoutExerciseWithSets;
    index: number;
    name: string;
    isFinished: boolean;
    onExpand: () => void;
    onMoveBySteps: (workoutExerciseId: number, steps: number) => void;
}

function CollapsedExerciseCard({ item, index, name, isFinished, onExpand, onMoveBySteps }: CollapsedProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createCollapsedCardStyles(colors), [colors]);
    const dragStep = useSharedValue(0);
    const isDragging = useSharedValue(false);

    const totalSets = item.sets.length;
    const completedSets = item.sets.filter((s) => !!s.completed_at).length;
    const isAllDone = totalSets > 0 && completedSets === totalSets;
    const summary = bestSetSummary(item.sets);

    function getProgressLabel(): string {
        if (totalSets === 0) return t("exercise.exerciseCard.noSetsYet");
        if (isAllDone) return t("exercise.exerciseCard.allSetsComplete", { total: totalSets });
        return t("exercise.exerciseCard.setsProgress", { completed: completedSets, total: totalSets });
    }

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(isDragging.value ? 1.03 : 1, { damping: 15 }) }],
        opacity: isDragging.value ? 0.92 : 1,
        shadowOpacity: isDragging.value ? 0.25 : 0,
        shadowRadius: isDragging.value ? 8 : 0,
        elevation: isDragging.value ? 6 : 0,
        zIndex: isDragging.value ? 10 : 0,
    }));

    const panGesture = Gesture.Pan()
        .enabled(!isFinished)
        .activateAfterLongPress(DRAG_ACTIVATION_LONG_PRESS_MS)
        .onStart(() => {
            "worklet";
            isDragging.value = true;
            dragStep.value = 0;
        })
        .onUpdate((event) => {
            "worklet";
            const nextStep = Math.trunc(event.translationY / EXERCISE_DRAG_STEP_PX);
            if (nextStep === dragStep.value) return;
            const diff = nextStep - dragStep.value;
            dragStep.value = nextStep;
            runOnJS(onMoveBySteps)(item.workoutExercise.id, diff);
        })
        .onEnd(() => {
            "worklet";
            isDragging.value = false;
            dragStep.value = 0;
        });

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={animatedStyle}>
                <Pressable style={styles.card} onPress={onExpand}>
                    <Text style={styles.orderNum}>{index + 1}.</Text>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>

                    {summary ? (
                        <Text style={styles.bestSetText}>{summary}</Text>
                    ) : null}

                    <View style={[styles.progressBadge, isAllDone && styles.progressBadgeComplete]}>
                        {isAllDone && (
                            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                        )}
                        <Text style={[styles.progressText, isAllDone && styles.progressTextComplete]}>
                            {getProgressLabel()}
                        </Text>
                    </View>

                    <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textTertiary}
                        style={styles.chevron}
                    />
                </Pressable>
            </Animated.View>
        </GestureDetector>
    );
}
