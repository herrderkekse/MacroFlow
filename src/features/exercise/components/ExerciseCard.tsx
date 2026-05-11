import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Text, View } from "react-native";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { createCollapsedCardStyles } from "./ExerciseCardHelpers";
import { ExerciseCardMenu, ExerciseNoteModal } from "./ExerciseCardModals";
import { ExpandedExerciseCard } from "./ExpandedExerciseCard";
import type { SetValues } from "./SetInputRow";

interface ExerciseCardProps {
    item: WorkoutExerciseWithSets;
    index: number;
    isFinished: boolean;
    isExpanded: boolean;
    onExpand: () => void;
    onDragStart: () => void;
    lastWorkoutSets: ExerciseSet[];
    onRemove: (workoutExerciseId: number) => void;
    onNoteChange: (workoutExerciseId: number, note: string) => void;
    onConfirmSet: (setId: number, values: SetValues) => void;
    onUpdateSet: (setId: number, values: SetValues) => void;
    onDeleteSet: (setId: number) => void;
    onSetTypeChange: (setId: number, type: string) => void;
    onAddSet: (workoutExerciseId: number) => void;
    onCopyFromLast: (workoutExerciseId: number, templateId: number) => void;
    onReorderSets: (workoutExerciseId: number, from: number, to: number) => void;
    restTimerActive: boolean;
    restTimerElapsed: number;
    restTimerTarget: number;
    restTimerReached: boolean;
    onRestTimerSkip: () => void;
    onRestTimerChangeDuration: (seconds: number) => void;
}

export default function ExerciseCard({
    item, index, isFinished, isExpanded, onExpand, onDragStart, lastWorkoutSets,
    onRemove, onNoteChange,
    onConfirmSet, onUpdateSet, onDeleteSet, onSetTypeChange, onAddSet, onCopyFromLast, onReorderSets,
    restTimerActive, restTimerElapsed, restTimerTarget, restTimerReached, onRestTimerSkip,
    onRestTimerChangeDuration,
}: ExerciseCardProps) {
    const { t } = useTranslation();
    const template = item.exerciseTemplate;
    const name = template?.name ?? "?";
    const exerciseType: ExerciseType = (template?.type as ExerciseType) ?? "weight";

    const [menuOpen, setMenuOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState(item.workoutExercise.notes ?? "");

    function handleRemove() {
        Alert.alert(
            t("exercise.exerciseCard.remove"),
            t("exercise.exerciseCard.removeConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: () => onRemove(item.workoutExercise.id) },
            ],
        );
        setMenuOpen(false);
    }

    function handleSaveNote() {
        onNoteChange(item.workoutExercise.id, noteDraft.trim());
        setNoteOpen(false);
    }

    // Show collapsed card for non-expanded exercises
    if (!isExpanded) {
        return (
            <>
                <CollapsedExerciseCard
                    item={item}
                    index={index}
                    name={name}
                    onExpand={onExpand}
                    onLongPress={onDragStart}
                />
                <ExerciseCardMenu
                    visible={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    isFinished={isFinished}
                    hasNote={!!item.workoutExercise.notes}
                    hasTemplate={!!template}
                    onEditNote={() => { setMenuOpen(false); setNoteDraft(item.workoutExercise.notes ?? ""); setNoteOpen(true); }}
                    onCopyFromLast={() => { onCopyFromLast(item.workoutExercise.id, template!.id); setMenuOpen(false); }}
                    onRemove={handleRemove}
                    labels={{
                        editNote: t("exercise.exerciseCard.editNote"),
                        addNote: t("exercise.exerciseCard.addNote"),
                        copyFromLast: t("exercise.exerciseCard.copyFromLast"),
                        remove: t("exercise.exerciseCard.remove"),
                    }}
                />
                <ExerciseNoteModal
                    visible={noteOpen}
                    onClose={() => setNoteOpen(false)}
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    onSave={handleSaveNote}
                    labels={{
                        title: t("exercise.exerciseCard.note"),
                        placeholder: t("exercise.exerciseCard.notePlaceholder"),
                        save: t("common.save"),
                    }}
                />
            </>
        );
    }

    return (
        <ExpandedExerciseCard
            item={item}
            index={index}
            isFinished={isFinished}
            name={name}
            exerciseType={exerciseType}
            template={template}
            lastWorkoutSets={lastWorkoutSets}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            onDragStart={onDragStart}
            noteOpen={noteOpen}
            setNoteOpen={setNoteOpen}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            onRemove={onRemove}
            onNoteChange={onNoteChange}
            onConfirmSet={onConfirmSet}
            onUpdateSet={onUpdateSet}
            onDeleteSet={onDeleteSet}
            onSetTypeChange={onSetTypeChange}
            onAddSet={onAddSet}
            onCopyFromLast={onCopyFromLast}
            onReorderSets={onReorderSets}
            restTimerActive={restTimerActive}
            restTimerElapsed={restTimerElapsed}
            restTimerTarget={restTimerTarget}
            restTimerReached={restTimerReached}
            onRestTimerSkip={onRestTimerSkip}
            onRestTimerChangeDuration={onRestTimerChangeDuration}
        />
    );
}

// ── Collapsed card ──────────────────────────────────────────────────────────

interface CollapsedProps {
    item: WorkoutExerciseWithSets;
    index: number;
    name: string;
    onExpand: () => void;
    onLongPress: () => void;
}

function CollapsedExerciseCard({ item, index, name, onExpand, onLongPress }: CollapsedProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createCollapsedCardStyles(colors), [colors]);

    const totalSets = item.sets.length;
    const completedSets = item.sets.filter((s) => !!s.completed_at).length;
    const isAllDone = totalSets > 0 && completedSets === totalSets;

    function getProgressLabel(): string {
        if (totalSets === 0) return t("exercise.exerciseCard.noSetsYet");
        return t("exercise.exerciseCard.setsProgress", { completed: completedSets, total: totalSets });
    }

    return (
        <Pressable style={styles.card} onPress={onExpand} onLongPress={onLongPress}>
            <Text style={styles.orderNum}>{index + 1}.</Text>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>

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
