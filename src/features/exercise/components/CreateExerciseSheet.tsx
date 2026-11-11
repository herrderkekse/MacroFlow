import Button from "@/src/shared/atoms/Button";
import Sheet from "@/src/shared/components/Sheet";
import { spacing } from "@/src/utils/theme";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useExerciseForm } from "../hooks/useExerciseForm";
import type { ExerciseTemplate } from "../services/exerciseDb";
import ExerciseFormFields from "./ExerciseFormFields";

interface CreateExerciseSheetProps {
    visible: boolean;
    initialName?: string;
    onClose: () => void;
    onCreated: (template: ExerciseTemplate) => void;
}

/** Creates an exercise without leaving the picker it was opened from. */
export default function CreateExerciseSheet({ visible, initialName, onClose, onCreated }: CreateExerciseSheetProps) {
    const { t } = useTranslation();
    const form = useExerciseForm({ active: visible, initialName });

    function handleClose() {
        form.reset();
        onClose();
    }

    function handleSave() {
        const saved = form.save();
        if (saved) onCreated(saved);
    }

    return (
        <Sheet
            visible={visible}
            onClose={handleClose}
            title={t("exercise.createExercise.title")}
            footer={<Button title={t("common.save")} onPress={handleSave} />}
        >
            <ExerciseFormFields form={form} />
            <View style={styles.bottomSpace} />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    bottomSpace: { height: spacing.md },
});
