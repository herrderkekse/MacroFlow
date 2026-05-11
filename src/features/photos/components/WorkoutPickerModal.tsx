import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import type { Workout } from "@/src/features/exercise/services/workoutDb";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";

interface WorkoutPickerModalProps {
    visible: boolean;
    workouts: Workout[];
    selectedWorkoutId: number | null;
    onSelectWorkout: (workoutId: number | null) => void;
    onClose: () => void;
}

export default function WorkoutPickerModal({
    visible,
    workouts,
    selectedWorkoutId,
    onSelectWorkout,
    onClose,
}: WorkoutPickerModalProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalCard} onPress={() => {}}>
                    <Text style={styles.modalTitle}>{t("log.photoDetailsWorkoutPickerTitle")}</Text>

                    <Pressable style={styles.workoutOption} onPress={() => onSelectWorkout(null)}>
                        <Text style={styles.workoutOptionText}>{t("log.photoDetailsNoWorkout")}</Text>
                    </Pressable>

                    {workouts.length === 0 ? (
                        <Text style={styles.emptyWorkoutText}>{t("log.photoDetailsNoRecentWorkouts")}</Text>
                    ) : (
                        <ScrollView style={styles.workoutList}>
                            {workouts.map((workout) => {
                                const label = workout.title?.trim() ? workout.title : t("log.photoDetailsUntitledWorkout");
                                const selected = selectedWorkoutId === workout.id;

                                return (
                                    <Pressable
                                        key={workout.id}
                                        style={[styles.workoutOption, selected && styles.workoutOptionSelected]}
                                        onPress={() => onSelectWorkout(workout.id)}
                                    >
                                        <Text style={styles.workoutOptionText}>{label}</Text>
                                        <Text style={styles.workoutOptionDate}>{workout.date}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}

                    <Button title={t("common.done")} onPress={onClose} />
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            padding: spacing.md,
        },
        modalCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            gap: spacing.sm,
            maxHeight: "80%",
        },
        modalTitle: {
            fontSize: fontSize.lg,
            color: colors.text,
            fontWeight: "700",
            marginBottom: spacing.xs,
        },
        workoutList: {
            maxHeight: 300,
        },
        workoutOption: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            borderRadius: borderRadius.sm,
        },
        workoutOptionSelected: {
            backgroundColor: colors.background,
        },
        workoutOptionText: {
            color: colors.text,
            fontSize: fontSize.md,
            fontWeight: "600",
        },
        workoutOptionDate: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            marginTop: spacing.xs,
        },
        emptyWorkoutText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
        },
    });
}
