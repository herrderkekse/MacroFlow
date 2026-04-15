import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { bestSetSummary, createCollapsedCardStyles } from "./ExerciseCardHelpers";
import { ExpandedExerciseCard } from "./ExpandedExerciseCard";
import type { SetValues } from "./SetInputRow";

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
    onNoteChange: (workoutExerciseId: number, note: string) => void;
    onConfirmSet: (setId: number, values: SetValues) => void;
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
    onRemove, onMoveUp, onMoveDown, onNoteChange,
    onConfirmSet, onDeleteSet, onSetTypeChange, onAddSet, onCopyFromLast,
    restTimerActive, restTimerElapsed, restTimerTarget, restTimerReached, onRestTimerSkip,
}: ExerciseCardProps) {
    const template = item.exerciseTemplate;
    const name = template?.name ?? "?";
    const exerciseType: ExerciseType = (template?.type as ExerciseType) ?? "weight";

    const [menuOpen, setMenuOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState(item.workoutExercise.notes ?? "");

    // Show collapsed card for non-expanded, non-finished exercises
    if (!isExpanded && !isFinished) {
        return (
            <CollapsedExerciseCard
                item={item}
                index={index}
                name={name}
                onExpand={onExpand}
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
            onNoteChange={onNoteChange}
            onConfirmSet={onConfirmSet}
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
    onExpand: () => void;
}

function CollapsedExerciseCard({ item, index, name, onExpand }: CollapsedProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createCollapsedCardStyles(colors), [colors]);

    const totalSets = item.sets.length;
    const completedSets = item.sets.filter((s) => !!s.completed_at).length;
    const isAllDone = totalSets > 0 && completedSets === totalSets;
    const summary = bestSetSummary(item.sets);

    function getProgressLabel(): string {
        if (totalSets === 0) return t("exercise.exerciseCard.noSetsYet");
        if (isAllDone) return t("exercise.exerciseCard.allSetsComplete", { total: totalSets });
        return t("exercise.exerciseCard.setsProgress", { completed: completedSets, total: totalSets });
    }

    return (
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
    );
}
