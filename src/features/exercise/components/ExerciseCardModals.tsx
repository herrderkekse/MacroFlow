import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import ActionSheet, { type ActionSheetItem } from "@/src/shared/components/ActionSheet";
import Sheet from "@/src/shared/components/Sheet";
import { spacing } from "@/src/utils/theme";
import React from "react";
import { StyleSheet } from "react-native";

interface ExerciseCardMenuProps {
    visible: boolean;
    onClose: () => void;
    /** Name of the exercise the menu belongs to. */
    title?: string;
    isFinished: boolean;
    hasNote: boolean;
    hasTemplate: boolean;
    onEditNote: () => void;
    onCopyFromLast: () => void;
    onRemove: () => void;
    /** When provided (and not finished), shows a "Superset with…" action. */
    onSuperset?: () => void;
    labels: {
        editNote: string;
        addNote: string;
        copyFromLast: string;
        superset?: string;
        remove: string;
    };
}

/** The secondary actions of one exercise in a workout. */
export function ExerciseCardMenu({
    visible, onClose, title, isFinished,
    hasNote, hasTemplate,
    onEditNote, onCopyFromLast, onRemove, onSuperset,
    labels,
}: ExerciseCardMenuProps) {
    const actions: ActionSheetItem[] = [
        { key: "note", icon: "create-outline", label: hasNote ? labels.editNote : labels.addNote, onPress: onEditNote },
    ];
    if (hasTemplate) {
        actions.push({ key: "copy", icon: "copy-outline", label: labels.copyFromLast, onPress: onCopyFromLast });
    }
    if (!isFinished && onSuperset && labels.superset) {
        actions.push({ key: "superset", icon: "git-merge-outline", label: labels.superset, onPress: onSuperset });
    }
    actions.push({ key: "remove", icon: "trash-outline", label: labels.remove, onPress: onRemove, destructive: true });

    return <ActionSheet visible={visible} onClose={onClose} title={title} actions={actions} />;
}

interface ExerciseNoteModalProps {
    visible: boolean;
    onClose: () => void;
    value: string;
    onChangeText: (text: string) => void;
    onSave: () => void;
    labels: { title: string; placeholder: string; save: string };
}

/** Edits the free-text note of one exercise in a workout. */
export function ExerciseNoteModal({ visible, onClose, value, onChangeText, onSave, labels }: ExerciseNoteModalProps) {
    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={labels.title}
            footer={<Button title={labels.save} onPress={onSave} />}
        >
            <Input
                value={value}
                onChangeText={onChangeText}
                placeholder={labels.placeholder}
                multiline
                autoFocus
                style={styles.input}
                containerStyle={styles.container}
            />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    input: { minHeight: 96 },
    container: { marginBottom: spacing.md },
});
