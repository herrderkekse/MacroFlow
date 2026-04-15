import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Text, View } from "react-native";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { createExerciseCardStyles, getPrefillForSet, isActiveSet } from "./ExerciseCardHelpers";
import { ExerciseCardMenu, ExerciseNoteModal } from "./ExerciseCardModals";
import RestTimer from "./RestTimer";
import SetInputRow, { type SetValues } from "./SetInputRow";

interface ExerciseCardProps {
    item: WorkoutExerciseWithSets;
    index: number;
    totalExercises: number;
    isFinished: boolean;
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
    item, index, totalExercises, isFinished, lastWorkoutSets,
    onRemove, onMoveUp, onMoveDown, onNoteChange,
    onConfirmSet, onDeleteSet, onSetTypeChange, onAddSet, onCopyFromLast,
    restTimerActive, restTimerElapsed, restTimerTarget, restTimerReached, onRestTimerSkip,
}: ExerciseCardProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createExerciseCardStyles(colors), [colors]);
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState(item.workoutExercise.notes ?? "");

    const template = item.exerciseTemplate;
    const name = template?.name ?? "?";
    const exerciseType: ExerciseType = (template?.type as ExerciseType) ?? "weight";

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

    function handleHistory() {
        if (template) {
            router.push({
                pathname: "/workout/exercise-history",
                params: { templateId: String(template.id), name: template.name },
            });
        }
    }

    function handleSaveNote() {
        onNoteChange(item.workoutExercise.id, noteDraft.trim());
        setNoteOpen(false);
    }

    return (
        <View style={styles.card}>
            {/* Title row */}
            <View style={styles.titleRow}>
                <Text style={styles.orderNum}>{index + 1}.</Text>
                <Text style={styles.exerciseName} numberOfLines={1}>{name}</Text>
                <Pressable onPress={handleHistory} hitSlop={8}>
                    <Ionicons name="bar-chart-outline" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
                    <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                </Pressable>
            </View>

            {/* Note display */}
            {item.workoutExercise.notes ? (
                <Text style={styles.noteText} numberOfLines={2}>
                    {item.workoutExercise.notes}
                </Text>
            ) : null}

            {/* Column headers */}
            <View style={styles.headerRow}>
                <Text style={[styles.headerCell, styles.setCol]}>{t("exercise.exerciseCard.set")}</Text>
                {exerciseType === "weight" && (
                    <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.weight")}</Text>
                )}
                {exerciseType !== "cardio" && (
                    <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.reps")}</Text>
                )}
                {exerciseType === "cardio" && (
                    <>
                        <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.duration")}</Text>
                        <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.distance")}</Text>
                    </>
                )}
                {exerciseType !== "cardio" && (
                    <Text style={[styles.headerCell, styles.rirCol]}>{t("exercise.exerciseCard.rir")}</Text>
                )}
                <Text style={[styles.headerCell, styles.checkCol]}>✓</Text>
            </View>

            {/* Set rows */}
            {item.sets.map((set, si) => {
                const prefill = getPrefillForSet(si, item.sets, lastWorkoutSets);
                const isActive = isActiveSet(set, si, item.sets);
                return (
                    <React.Fragment key={set.id}>
                        {/* Rest timer between last completed set and active input */}
                        {isActive && restTimerActive && (
                            <RestTimer
                                elapsedSeconds={restTimerElapsed}
                                targetSeconds={restTimerTarget}
                                isTargetReached={restTimerReached}
                                onSkip={onRestTimerSkip}
                            />
                        )}
                        <SetInputRow
                            set={set}
                            index={si}
                            exerciseType={exerciseType}
                            isActive={isActive}
                            isFinished={isFinished}
                            prefillWeight={prefill.weight}
                            prefillReps={prefill.reps}
                            prefillRir={prefill.rir}
                            prefillDuration={prefill.duration}
                            prefillDistance={prefill.distance}
                            onConfirm={onConfirmSet}
                            onDelete={onDeleteSet}
                            onTypeChange={onSetTypeChange}
                        />
                    </React.Fragment>
                );
            })}

            {/* Empty state */}
            {item.sets.length === 0 && (
                <Text style={styles.emptyText}>{t("exercise.workout.emptyState")}</Text>
            )}

            {/* + Add Set button */}
            {!isFinished && (
                <Pressable style={styles.addSetBtn} onPress={() => onAddSet(item.workoutExercise.id)}>
                    <Text style={styles.addSetText}>{t("exercise.exerciseCard.addSet")}</Text>
                </Pressable>
            )}

            <ExerciseCardMenu
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                index={index}
                totalExercises={totalExercises}
                isFinished={isFinished}
                hasNote={!!item.workoutExercise.notes}
                hasTemplate={!!template}
                onMoveUp={() => { onMoveUp(item.workoutExercise.id); setMenuOpen(false); }}
                onMoveDown={() => { onMoveDown(item.workoutExercise.id); setMenuOpen(false); }}
                onEditNote={() => { setMenuOpen(false); setNoteDraft(item.workoutExercise.notes ?? ""); setNoteOpen(true); }}
                onCopyFromLast={() => { onCopyFromLast(item.workoutExercise.id, template!.id); setMenuOpen(false); }}
                onRemove={handleRemove}
                labels={{
                    moveUp: t("exercise.exerciseCard.moveUp"),
                    moveDown: t("exercise.exerciseCard.moveDown"),
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
        </View>
    );
}
