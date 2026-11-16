import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { parseCustomFields } from "../helpers/customFields";
import { durationTargetFor } from "../helpers/durationClock";
import { useDurationClock } from "../hooks/useDurationClock";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { getPrefillForSet, isActiveSet, lastSessionLine } from "./ExerciseCardHelpers";
import SetInputRow, { type SetValues } from "./SetInputRow";
import { AddSetButton, CardTitle, ExpandedCardFrame, NoSetsLine, SetColumns } from "./WorkoutCardParts";

interface ExpandedExerciseCardProps {
    item: WorkoutExerciseWithSets;
    index: number;
    isFinished: boolean;
    name: string;
    exerciseType: ExerciseType;
    template: WorkoutExerciseWithSets["exerciseTemplate"];
    lastWorkoutSets: ExerciseSet[];
    onOpenMenu: () => void;
    onDragStart: () => void;
    onConfirmSet: (setId: number, values: SetValues) => void;
    onUpdateSet: (setId: number, values: SetValues) => void;
    onDeleteSet: (setId: number) => void;
    onSetTypeChange: (setId: number, type: string) => void;
    onAddSet: (workoutExerciseId: number) => void;
    onReorderSets: (workoutExerciseId: number, from: number, to: number) => void;
    /** Shows the clock of a timed exercise on the workout's pinned card. */
    onShowClock: () => void;
}

/** The exercise being worked on: its sets as rows, the next one highlighted. */
export function ExpandedExerciseCard({
    item, index, isFinished, name, exerciseType, template, lastWorkoutSets,
    onOpenMenu, onDragStart,
    onConfirmSet, onUpdateSet, onDeleteSet, onSetTypeChange, onAddSet, onReorderSets,
    onShowClock,
}: ExpandedExerciseCardProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const customFields = parseCustomFields(template?.custom_fields);
    const durationTarget = isFinished ? null : durationTargetFor(exerciseType, customFields);
    // The watch only shows whether the clock is going for this exercise; it needs no ticking.
    const clock = useDurationClock(item.workoutExercise.id, false);

    function handleHistory() {
        if (!template) return;
        router.push({
            pathname: "/workout/exercise-history",
            params: {
                templateId: String(template.id),
                name: template.name,
                workoutExerciseId: String(item.workoutExercise.id),
            },
        });
    }

    return (
        <ExpandedCardFrame onLongPress={onDragStart}>
            <CardTitle
                index={index}
                members={[{ key: item.workoutExercise.id, name, last: lastSessionLine(lastWorkoutSets, exerciseType, t) }]}
                note={item.workoutExercise.notes}
                onHistory={handleHistory}
                onMenu={onOpenMenu}
                onClock={durationTarget ? onShowClock : undefined}
                clockActive={clock.isOwn}
            />

            <SetColumns exerciseType={exerciseType} customFields={customFields} />

            <DraggableFlatList
                data={item.sets}
                keyExtractor={(set) => String(set.id)}
                scrollEnabled={false}
                activationDistance={0}
                onDragEnd={({ from, to }) => onReorderSets(item.workoutExercise.id, from, to)}
                renderItem={({ item: set, drag, getIndex }: RenderItemParams<ExerciseSet>) => {
                    const si = getIndex() ?? 0;
                    const prefill = getPrefillForSet(si, item.sets, lastWorkoutSets);
                    return (
                        <SetInputRow
                            set={set}
                            index={si}
                            isFirst={si === 0}
                            exerciseType={exerciseType}
                            customFields={customFields}
                            isActive={isActiveSet(set, si, item.sets)}
                            isFinished={isFinished}
                            prefillWeight={prefill.weight}
                            prefillReps={prefill.reps}
                            prefillRir={prefill.rir}
                            prefillDuration={prefill.duration}
                            prefillDistance={prefill.distance}
                            prefillCustom={prefill.custom}
                            durationTarget={durationTarget}
                            clockExerciseId={item.workoutExercise.id}
                            onConfirm={onConfirmSet}
                            onUpdate={onUpdateSet}
                            onDelete={onDeleteSet}
                            onTypeChange={onSetTypeChange}
                            onDragStart={drag}
                        />
                    );
                }}
            />

            {item.sets.length === 0 && <NoSetsLine />}

            <AddSetButton label={t("exercise.exerciseCard.addSet")} onPress={() => onAddSet(item.workoutExercise.id)} />
        </ExpandedCardFrame>
    );
}
