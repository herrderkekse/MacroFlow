import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import ModalHeader from "@/src/shared/atoms/ModalHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { EQUIPMENT_LIST, EXERCISE_TYPES, MUSCLE_GROUPS } from "../constants";
import { createExerciseTemplate, getExerciseTemplateById, updateExerciseTemplate, type ExerciseTemplate } from "../services/exerciseDb";
import type { Equipment, ExerciseType, MuscleGroup, ResistanceMode, WeightUnit } from "../types";
import ChipSelect from "./ChipSelect";

interface CreateExerciseModalProps {
    visible: boolean;
    exerciseId?: number;
    onClose: () => void;
    onCreated: (template: ExerciseTemplate) => void;
}

export default function CreateExerciseModal({ visible, exerciseId, onClose, onCreated }: CreateExerciseModalProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const isEditing = exerciseId != null;

    const [name, setName] = useState("");
    const [type, setType] = useState<ExerciseType>("weight");
    const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
    const [equipment, setEquipment] = useState<Equipment | null>(null);
    const [resistanceMode, setResistanceMode] = useState<ResistanceMode>("resistance");
    const [defaultUnit, setDefaultUnit] = useState<WeightUnit>("kg");
    const [nameError, setNameError] = useState(false);

    useEffect(() => {
        if (!visible || exerciseId == null) return;
        const existing = getExerciseTemplateById(exerciseId);
        if (!existing) return;
        setName(existing.name);
        setType((existing.type as ExerciseType) ?? "weight");
        setMuscleGroup((existing.muscle_group as MuscleGroup) ?? null);
        setEquipment((existing.equipment as Equipment) ?? null);
        setResistanceMode((existing.resistance_mode as ResistanceMode) ?? "resistance");
        setDefaultUnit((existing.default_weight_unit as WeightUnit) ?? "kg");
    }, [visible, exerciseId]);

    function resetForm() {
        setName("");
        setType("weight");
        setMuscleGroup(null);
        setEquipment(null);
        setResistanceMode("resistance");
        setDefaultUnit("kg");
        setNameError(false);
    }

    function handleClose() {
        resetForm();
        onClose();
    }

    function handleSave() {
        const trimmed = name.trim();
        if (!trimmed) {
            setNameError(true);
            return;
        }
        if (isEditing) {
            updateExerciseTemplate(exerciseId, {
                name: trimmed,
                type,
                muscle_group: muscleGroup,
                equipment,
                resistance_mode: resistanceMode,
                default_weight_unit: defaultUnit,
            });
            const updated = getExerciseTemplateById(exerciseId)!;
            resetForm();
            onCreated(updated);
        } else {
            const template = createExerciseTemplate({
                name: trimmed,
                type,
                muscle_group: muscleGroup,
                equipment,
                resistance_mode: resistanceMode,
                default_weight_unit: defaultUnit,
            });
            resetForm();
            onCreated(template);
        }
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex}
            >
                <ModalHeader title={t(isEditing ? "exercise.createExercise.editTitle" : "exercise.createExercise.title")} onClose={handleClose} />
                <ScrollView
                    contentContainerStyle={styles.form}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Input
                        label={t("exercise.createExercise.name")}
                        placeholder={t("exercise.createExercise.namePlaceholder")}
                        value={name}
                        onChangeText={(v) => { setName(v); setNameError(false); }}
                        autoFocus
                        returnKeyType="done"
                    />
                    {nameError && (
                        <Text style={styles.errorText}>{t("exercise.createExercise.nameRequired")}</Text>
                    )}

                    <Text style={styles.fieldLabel}>{t("exercise.createExercise.type")}</Text>
                    <ChipSelect
                        items={EXERCISE_TYPES.map((et) => ({ key: et.key, label: t(`exercise.types.${et.key}`) }))}
                        selected={type}
                        onSelect={(key) => setType(key ?? "weight")}
                    />

                    <Text style={styles.fieldLabel}>{t("exercise.createExercise.muscleGroup")}</Text>
                    <ChipSelect
                        items={MUSCLE_GROUPS.map((mg) => ({ key: mg.key, label: t(mg.labelKey) }))}
                        selected={muscleGroup}
                        onSelect={setMuscleGroup}
                        noneLabel={t("exercise.createExercise.none")}
                    />

                    <Text style={styles.fieldLabel}>{t("exercise.createExercise.equipment")}</Text>
                    <ChipSelect
                        items={EQUIPMENT_LIST.map((eq) => ({ key: eq.key, label: t(`exercise.equipment.${eq.key}`) }))}
                        selected={equipment}
                        onSelect={setEquipment}
                        noneLabel={t("exercise.createExercise.none")}
                    />

                    {type === "weight" && (
                        <>
                            <Text style={styles.fieldLabel}>{t("exercise.createExercise.resistanceMode")}</Text>
                            <View style={styles.radioRow}>
                                {(["resistance", "assistance"] as ResistanceMode[]).map((mode) => (
                                    <Pressable
                                        key={mode}
                                        onPress={() => setResistanceMode(mode)}
                                        style={styles.radioOption}
                                    >
                                        <View style={[styles.radioOuter, resistanceMode === mode && styles.radioOuterActive]}>
                                            {resistanceMode === mode && <View style={styles.radioInner} />}
                                        </View>
                                        <Text style={styles.radioLabel}>
                                            {t(`exercise.createExercise.${mode}`)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    )}

                    <Text style={styles.fieldLabel}>{t("exercise.createExercise.defaultUnit")}</Text>
                    <ChipSelect
                        items={(["kg", "lb"] as WeightUnit[]).map((u) => ({ key: u, label: u }))}
                        selected={defaultUnit}
                        onSelect={(key) => setDefaultUnit(key ?? "kg")}
                        horizontal={false}
                    />

                    <Button title={t("common.save")} onPress={handleSave} style={styles.saveButton} />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        form: { padding: spacing.lg, gap: spacing.md },
        fieldLabel: {
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.textSecondary,
            marginBottom: spacing.xs,
        },
        errorText: {
            fontSize: fontSize.sm,
            color: colors.danger,
            marginTop: -spacing.sm,
        },
        radioRow: {
            flexDirection: "row",
            gap: spacing.xl,
        },
        radioOption: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        radioOuter: {
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },
        radioOuterActive: {
            borderColor: colors.primary,
        },
        radioInner: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.primary,
        },
        radioLabel: {
            fontSize: fontSize.md,
            color: colors.text,
        },
        saveButton: { marginTop: spacing.sm },
    });
}
