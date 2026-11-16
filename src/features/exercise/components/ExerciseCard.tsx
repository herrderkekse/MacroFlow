import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { ExerciseCardMenu, ExerciseNoteModal } from "./ExerciseCardModals";
import { ExpandedExerciseCard } from "./ExpandedExerciseCard";
import type { SetValues } from "./SetInputRow";
import { CollapsedCard } from "./WorkoutCardParts";

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
    onSuperset: (baseWorkoutExerciseId: number) => void;
}

/** One exercise of a workout: a one-line card until it is opened to log its sets. */
export default function ExerciseCard({
    item, index, isFinished, isExpanded, onExpand, onDragStart, lastWorkoutSets,
    onRemove, onNoteChange,
    onConfirmSet, onUpdateSet, onDeleteSet, onSetTypeChange, onAddSet, onCopyFromLast, onReorderSets,
    onSuperset,
}: ExerciseCardProps) {
    const { t } = useTranslation();
    const template = item.exerciseTemplate;
    const name = template?.name ?? "?";
    const exerciseType: ExerciseType = (template?.type as ExerciseType) ?? "weight";

    const [menuOpen, setMenuOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState(item.workoutExercise.notes ?? "");

    function handleRemove() {
        setMenuOpen(false);
        Alert.alert(
            t("exercise.exerciseCard.remove"),
            t("exercise.exerciseCard.removeConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: () => onRemove(item.workoutExercise.id) },
            ],
        );
    }

    function handleSaveNote() {
        onNoteChange(item.workoutExercise.id, noteDraft.trim());
        setNoteOpen(false);
    }

    const done = item.sets.filter((s) => !!s.completed_at).length;

    return (
        <>
            {isExpanded ? (
                <ExpandedExerciseCard
                    item={item}
                    index={index}
                    isFinished={isFinished}
                    name={name}
                    exerciseType={exerciseType}
                    template={template}
                    lastWorkoutSets={lastWorkoutSets}
                    onOpenMenu={() => setMenuOpen(true)}
                    onDragStart={onDragStart}
                    onConfirmSet={onConfirmSet}
                    onUpdateSet={onUpdateSet}
                    onDeleteSet={onDeleteSet}
                    onSetTypeChange={onSetTypeChange}
                    onAddSet={onAddSet}
                    onReorderSets={onReorderSets}
                />
            ) : (
                <CollapsedCard
                    index={index}
                    title={name}
                    done={done}
                    total={item.sets.length}
                    onExpand={onExpand}
                    onLongPress={onDragStart}
                />
            )}
            <ExerciseCardMenu
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                title={name}
                isFinished={isFinished}
                hasNote={!!item.workoutExercise.notes}
                hasTemplate={!!template}
                onEditNote={() => { setMenuOpen(false); setNoteDraft(item.workoutExercise.notes ?? ""); setNoteOpen(true); }}
                onCopyFromLast={() => { onCopyFromLast(item.workoutExercise.id, template!.id); setMenuOpen(false); }}
                onRemove={handleRemove}
                onSuperset={template ? () => { setMenuOpen(false); onSuperset(item.workoutExercise.id); } : undefined}
                labels={{
                    editNote: t("exercise.exerciseCard.editNote"),
                    addNote: t("exercise.exerciseCard.addNote"),
                    copyFromLast: t("exercise.exerciseCard.copyFromLast"),
                    superset: t("exercise.exerciseCard.superset"),
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
