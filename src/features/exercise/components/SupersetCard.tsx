import ActionSheet from "@/src/shared/components/ActionSheet";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { parseCustomFields } from "../helpers/customFields";
import { activeRowIndex, nextAddTarget, orderSupersetRows, type SupersetRow, type WorkoutCard } from "../helpers/supersets";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { getPrefillForSet, lastSessionLine } from "./ExerciseCardHelpers";
import { ExerciseNoteModal } from "./ExerciseCardModals";
import SetInputRow, { type SetValues } from "./SetInputRow";
import { AddSetButton, CardTitle, CollapsedCard, ExpandedCardFrame, NoSetsLine, SetColumns } from "./WorkoutCardParts";

/** Each member's letter; a set row reads "A1", "B1", … to tie it to its exercise. */
const LETTERS = ["A", "B", "C", "D"];

interface SupersetCardProps {
    card: WorkoutCard;
    index: number;
    isFinished: boolean;
    isExpanded: boolean;
    onExpand: () => void;
    onDragStart: () => void;
    getLastSets: (templateId: number | null) => ExerciseSet[];
    onRemove: (workoutExerciseId: number) => void;
    onNoteChange: (workoutExerciseId: number, note: string) => void;
    onConfirmSet: (setId: number, values: SetValues) => void;
    onUpdateSet: (setId: number, values: SetValues) => void;
    onDeleteSet: (setId: number) => void;
    onSetTypeChange: (setId: number, type: string) => void;
    onAddSet: (workoutExerciseId: number) => void;
    onCopyFromLast: (workoutExerciseId: number, templateId: number) => void;
    onReorderSet: (setId: number, toIndex: number) => void;
}

export default function SupersetCard(props: SupersetCardProps) {
    const { card, index, isExpanded, onExpand, onDragStart } = props;
    if (!isExpanded) {
        const sets = card.members.flatMap((m) => m.sets);
        return (
            <CollapsedCard
                index={index}
                title={card.members.map((m) => m.exerciseTemplate?.name ?? "?").join(" + ")}
                isSuperset
                done={sets.filter((s) => !!s.completed_at).length}
                total={sets.length}
                onExpand={onExpand}
                onLongPress={onDragStart}
            />
        );
    }
    return <ExpandedSupersetCard {...props} />;
}

function ExpandedSupersetCard({
    card, index, isFinished, onDragStart, getLastSets,
    onRemove, onNoteChange, onConfirmSet, onUpdateSet, onDeleteSet, onSetTypeChange, onAddSet, onCopyFromLast, onReorderSet,
}: SupersetCardProps) {
    const { t } = useTranslation();
    const router = useRouter();

    const [menuOpen, setMenuOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState("");

    const members = card.members;
    // A superset carries a single, shared note — kept on the base (first) member.
    const noteHost = members[0];
    const rows = useMemo(() => orderSupersetRows(members), [members]);
    const activeIdx = isFinished ? -1 : activeRowIndex(rows);
    const addTarget = nextAddTarget(members);

    function renderRow({ item: row, drag, getIndex }: RenderItemParams<SupersetRow>) {
        const i = getIndex() ?? 0;
        const member = members[row.memberIndex];
        const template = member.exerciseTemplate;
        const exerciseType = (template?.type as ExerciseType) ?? "weight";
        const customFields = parseCustomFields(template?.custom_fields);
        const prefill = getPrefillForSet(row.withinIndex, member.sets, getLastSets(template?.id ?? null));
        return (
            <SetInputRow
                set={row.set}
                index={row.withinIndex}
                letter={LETTERS[row.memberIndex]}
                isFirst={i === 0}
                exerciseType={exerciseType}
                customFields={customFields}
                isActive={i === activeIdx}
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
    }

    // Column headings only make sense while both members log the same values.
    const sameType = members.every((m) => m.exerciseTemplate?.type === members[0].exerciseTemplate?.type);
    const headerType = (members[0].exerciseTemplate?.type as ExerciseType) ?? "weight";

    function handleRemove(member: WorkoutExerciseWithSets) {
        setMenuOpen(false);
        Alert.alert(
            t("exercise.superset.removeMember", { name: member.exerciseTemplate?.name ?? "" }),
            t("exercise.superset.removeMemberConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: () => onRemove(member.workoutExercise.id) },
            ],
        );
    }

    function handleHistory() {
        const valid = members.filter((m) => m.exerciseTemplate);
        if (valid.length === 0) return;
        router.push({
            pathname: "/workout/exercise-history",
            params: {
                templateId: String(valid[0].exerciseTemplate!.id),
                name: valid[0].exerciseTemplate!.name,
                workoutExerciseId: String(valid[0].workoutExercise.id),
                templateIds: valid.map((m) => m.exerciseTemplate!.id).join(","),
                workoutExerciseIds: valid.map((m) => m.workoutExercise.id).join(","),
            },
        });
    }

    return (
        <ExpandedCardFrame onLongPress={onDragStart}>
            <CardTitle
                index={index}
                members={members.map((m, i) => ({
                    key: m.workoutExercise.id,
                    letter: LETTERS[i],
                    name: m.exerciseTemplate?.name ?? "?",
                    last: lastSessionLine(
                        getLastSets(m.exerciseTemplate?.id ?? null),
                        (m.exerciseTemplate?.type as ExerciseType) ?? "weight",
                        t,
                    ),
                }))}
                note={noteHost.workoutExercise.notes}
                onHistory={handleHistory}
                onMenu={() => setMenuOpen(true)}
            />

            {sameType && (
                <SetColumns
                    exerciseType={headerType}
                    customFields={parseCustomFields(members[0].exerciseTemplate?.custom_fields)}
                />
            )}

            {/* Both members' sets in one list, in the order they are done. */}
            <DraggableFlatList
                data={rows}
                keyExtractor={(row) => String(row.set.id)}
                scrollEnabled={false}
                activationDistance={0}
                onDragEnd={({ from, to }) => { if (from !== to) onReorderSet(rows[from].set.id, to); }}
                renderItem={renderRow}
            />

            {rows.length === 0 && <NoSetsLine />}

            {!isFinished && (
                <AddSetButton
                    label={t("exercise.superset.addSetTo", { letter: LETTERS[addTarget] })}
                    onPress={() => onAddSet(members[addTarget].workoutExercise.id)}
                />
            )}

            {/* One menu: the shared note, then copy and remove per member. */}
            <ActionSheet
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                title={t("exercise.superset.menuTitle")}
                actions={[
                    {
                        key: "note",
                        icon: "create-outline",
                        label: noteHost.workoutExercise.notes ? t("exercise.exerciseCard.editNote") : t("exercise.exerciseCard.addNote"),
                        onPress: () => { setNoteDraft(noteHost.workoutExercise.notes ?? ""); setNoteOpen(true); },
                    },
                    ...members.filter((member) => member.exerciseTemplate).map((member) => ({
                        key: `copy-${member.workoutExercise.id}`,
                        icon: "copy-outline" as const,
                        label: t("exercise.superset.copyMember", { name: member.exerciseTemplate!.name }),
                        onPress: () => onCopyFromLast(member.workoutExercise.id, member.exerciseTemplate!.id),
                    })),
                    ...members.map((member) => ({
                        key: `remove-${member.workoutExercise.id}`,
                        icon: "trash-outline" as const,
                        label: t("exercise.superset.removeMember", { name: member.exerciseTemplate?.name ?? "" }),
                        destructive: true,
                        onPress: () => handleRemove(member),
                    })),
                ]}
            />

            <ExerciseNoteModal
                visible={noteOpen}
                onClose={() => setNoteOpen(false)}
                value={noteDraft}
                onChangeText={setNoteDraft}
                onSave={() => { onNoteChange(noteHost.workoutExercise.id, noteDraft.trim()); setNoteOpen(false); }}
                labels={{
                    title: t("exercise.exerciseCard.note"),
                    placeholder: t("exercise.exerciseCard.notePlaceholder"),
                    save: t("common.save"),
                }}
            />
        </ExpandedCardFrame>
    );
}
