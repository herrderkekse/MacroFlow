import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { parseCustomFields } from "../helpers/customFields";
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
}

/** The exercise being worked on: its sets as rows, the next one highlighted. */
export function ExpandedExerciseCard({
    item, index, isFinished, name, exerciseType, template, lastWorkoutSets,
    onOpenMenu, onDragStart,
    onConfirmSet, onUpdateSet, onDeleteSet, onSetTypeChange, onAddSet, onReorderSets,
}: ExpandedExerciseCardProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const customFields = parseCustomFields(template?.custom_fields);

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
