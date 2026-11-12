import FieldLabel from "@/src/shared/atoms/FieldLabel";
import Input from "@/src/shared/atoms/Input";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing } from "@/src/utils/theme";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { EQUIPMENT_LIST, EXERCISE_TYPES, MUSCLE_GROUPS } from "../constants";
import type { ExerciseForm } from "../hooks/useExerciseForm";
import type { ExerciseType, ResistanceMode, WeightUnit } from "../types";
import ChipSelect from "./ChipSelect";
import CustomFieldsEditor from "./CustomFieldsEditor";

interface ExerciseFormFieldsProps {
    form: ExerciseForm;
    autoFocus?: boolean;
}

/** The fields of an exercise template, shared by the editor screen and the create sheet. */
export default function ExerciseFormFields({ form, autoFocus = false }: ExerciseFormFieldsProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();

    return (
        <>
            <Input
                label={t("exercise.createExercise.name")}
                placeholder={t("exercise.createExercise.namePlaceholder")}
                value={form.name}
                onChangeText={form.changeName}
                autoFocus={autoFocus}
                returnKeyType="done"
            />
            {form.nameError && (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                    {t("exercise.createExercise.nameRequired")}
                </Text>
            )}

            <FieldLabel>{t("exercise.createExercise.type")}</FieldLabel>
            <SegmentedControl<ExerciseType>
                options={EXERCISE_TYPES.map((et) => ({ key: et.key, label: t(`exercise.types.${et.key}`) }))}
                value={form.type}
                onChange={form.setType}
            />

            <FieldLabel>{t("exercise.createExercise.muscleGroup")}</FieldLabel>
            <ChipSelect
                items={MUSCLE_GROUPS.map((mg) => ({ key: mg.key, label: t(mg.labelKey) }))}
                selected={form.muscleGroup}
                onSelect={form.setMuscleGroup}
            />

            <FieldLabel>{t("exercise.createExercise.equipment")}</FieldLabel>
            <ChipSelect
                items={EQUIPMENT_LIST.map((eq) => ({ key: eq.key, label: t(`exercise.equipment.${eq.key}`) }))}
                selected={form.equipment}
                onSelect={form.setEquipment}
            />

            {form.type === "other" && (
                <CustomFieldsEditor fields={form.customFields} onChange={form.setCustomFields} />
            )}

            {form.type === "weight" && (
                <>
                    <FieldLabel>{t("exercise.createExercise.resistanceMode")}</FieldLabel>
                    <SegmentedControl<ResistanceMode>
                        options={[
                            { key: "resistance", label: t("exercise.createExercise.resistance") },
                            { key: "assistance", label: t("exercise.createExercise.assistance") },
                        ]}
                        value={form.resistanceMode}
                        onChange={form.setResistanceMode}
                    />
                </>
            )}

            <FieldLabel>{t("exercise.createExercise.defaultUnit")}</FieldLabel>
            <SegmentedControl<WeightUnit>
                options={[{ key: "kg", label: "kg" }, { key: "lb", label: "lb" }]}
                value={form.defaultUnit}
                onChange={form.setDefaultUnit}
            />
        </>
    );
}

const styles = StyleSheet.create({
    errorText: { fontSize: fontSize.xs, marginTop: spacing.xs },
});
