import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import ModalHeader from "@/src/shared/atoms/ModalHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useState } from "react";
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
import { createExerciseTemplate, type ExerciseTemplate } from "../services/exerciseDb";
import type { Equipment, ExerciseType, MuscleGroup, ResistanceMode, WeightUnit } from "../types";

interface CreateExerciseModalProps {
    visible: boolean;
    onClose: () => void;
    onCreated: (template: ExerciseTemplate) => void;
}

export default function CreateExerciseModal({ visible, onClose, onCreated }: CreateExerciseModalProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [name, setName] = useState("");
    const [type, setType] = useState<ExerciseType>("weight");
    const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
    const [equipment, setEquipment] = useState<Equipment | null>(null);
    const [resistanceMode, setResistanceMode] = useState<ResistanceMode>("resistance");
    const [defaultUnit, setDefaultUnit] = useState<WeightUnit>("kg");
    const [nameError, setNameError] = useState(false);

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
                <ModalHeader title={t("exercise.createExercise.title")} onClose={handleClose} />
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
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        {EXERCISE_TYPES.map((et) => (
                            <Pressable
                                key={et.key}
                                onPress={() => setType(et.key)}
                                style={[styles.chip, type === et.key && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, type === et.key && styles.chipTextActive]}>
                                    {t(`exercise.types.${et.key}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <Text style={styles.fieldLabel}>{t("exercise.createExercise.muscleGroup")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        <Pressable
                            onPress={() => setMuscleGroup(null)}
                            style={[styles.chip, muscleGroup === null && styles.chipActive]}
                        >
                            <Text style={[styles.chipText, muscleGroup === null && styles.chipTextActive]}>
                                {t("exercise.createExercise.none")}
                            </Text>
                        </Pressable>
                        {MUSCLE_GROUPS.map((mg) => (
                            <Pressable
                                key={mg.key}
                                onPress={() => setMuscleGroup(mg.key)}
                                style={[styles.chip, muscleGroup === mg.key && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, muscleGroup === mg.key && styles.chipTextActive]}>
                                    {t(mg.labelKey)}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <Text style={styles.fieldLabel}>{t("exercise.createExercise.equipment")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        <Pressable
                            onPress={() => setEquipment(null)}
                            style={[styles.chip, equipment === null && styles.chipActive]}
                        >
                            <Text style={[styles.chipText, equipment === null && styles.chipTextActive]}>
                                {t("exercise.createExercise.none")}
                            </Text>
                        </Pressable>
                        {EQUIPMENT_LIST.map((eq) => (
                            <Pressable
                                key={eq.key}
                                onPress={() => setEquipment(eq.key)}
                                style={[styles.chip, equipment === eq.key && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, equipment === eq.key && styles.chipTextActive]}>
                                    {t(`exercise.equipment.${eq.key}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>

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
                    <View style={styles.chipRow}>
                        {(["kg", "lb"] as WeightUnit[]).map((u) => (
                            <Pressable
                                key={u}
                                onPress={() => setDefaultUnit(u)}
                                style={[styles.chip, defaultUnit === u && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, defaultUnit === u && styles.chipTextActive]}>
                                    {u}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

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
        chipRow: {
            flexDirection: "row",
            gap: spacing.sm,
            paddingBottom: spacing.xs,
        },
        chip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        chipActive: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
        },
        chipText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        chipTextActive: {
            color: colors.primary,
            fontWeight: "600",
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
