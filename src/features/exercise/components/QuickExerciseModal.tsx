import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatDateKey } from "@/src/utils/date";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AddExerciseModal from "./AddExerciseModal";
import {
    addExerciseToWorkout,
    addSet,
    createWorkout,
    finishWorkout,
    getWorkoutsByDate,
    type ExerciseTemplate,
} from "../services/exerciseDb";

interface QuickExerciseModalProps {
    visible: boolean;
    date: Date;
    onClose: () => void;
    onSaved: () => void;
}

export default function QuickExerciseModal({ visible, date, onClose, onSaved }: QuickExerciseModalProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [template, setTemplate] = useState<ExerciseTemplate | null>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [weight, setWeight] = useState("");
    const [reps, setReps] = useState("");
    const [sets, setSets] = useState("3");
    const [durationMin, setDurationMin] = useState("");
    const [distance, setDistance] = useState("");

    const isCardio = template?.type === "cardio";
    const isBodyweight = template?.type === "bodyweight";

    function reset() {
        setTemplate(null);
        setWeight("");
        setReps("");
        setSets("3");
        setDurationMin("");
        setDistance("");
    }

    function handleClose() {
        reset();
        onClose();
    }

    function handleSave() {
        if (!template) return;

        const dateKey = formatDateKey(date);
        const now = Date.now();

        // Find or create a workout for today
        const existing = getWorkoutsByDate(dateKey);
        let workoutId: number;
        let autoFinish = false;

        if (existing.length > 0 && !existing[0].ended_at) {
            workoutId = existing[0].id;
        } else {
            const w = createWorkout({ date: dateKey, started_at: now });
            workoutId = w.id;
            autoFinish = true;
        }

        const we = addExerciseToWorkout({
            workout_id: workoutId,
            exercise_template_id: template.id,
            sort_order: 1,
        });

        if (isCardio) {
            addSet({
                workout_exercise_id: we.id,
                set_order: 1,
                type: "working",
                duration_seconds: durationMin ? Math.round(parseFloat(durationMin) * 60) : null,
                distance_meters: distance ? parseFloat(distance) * 1000 : null,
                completed_at: now,
            });
        } else {
            const numSets = Math.max(1, parseInt(sets, 10) || 1);
            const w = isBodyweight ? null : (parseFloat(weight) || null);
            const r = parseInt(reps, 10) || null;

            for (let i = 1; i <= numSets; i++) {
                addSet({
                    workout_exercise_id: we.id,
                    set_order: i,
                    type: "working",
                    weight: w,
                    reps: r,
                    completed_at: now,
                });
            }
        }

        if (autoFinish) {
            finishWorkout(workoutId, now);
        }

        reset();
        onSaved();
        onClose();
    }

    const canSave = template !== null;

    return (
        <>
            <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
                <Pressable style={styles.overlay} onPress={handleClose}>
                    <Pressable style={styles.sheet} onPress={() => { }}>
                        <View style={styles.header}>
                            <Text style={styles.title}>{t("exercise.quickAdd.title")}</Text>
                            <Pressable onPress={handleClose} hitSlop={8}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Exercise picker */}
                            <Pressable style={styles.pickerBtn} onPress={() => setShowPicker(true)}>
                                <Text style={template ? styles.pickerText : styles.pickerPlaceholder}>
                                    {template ? template.name : t("exercise.addExercise.searchPlaceholder")}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                            </Pressable>

                            {/* Weight exercise fields */}
                            {template && !isCardio && (
                                <View style={styles.fieldGroup}>
                                    {!isBodyweight && (
                                        <Input
                                            label={t("exercise.exerciseCard.weight")}
                                            value={weight}
                                            onChangeText={setWeight}
                                            keyboardType="decimal-pad"
                                            placeholder={template.default_weight_unit}
                                            containerStyle={styles.field}
                                        />
                                    )}
                                    <Input
                                        label={t("exercise.exerciseCard.reps")}
                                        value={reps}
                                        onChangeText={setReps}
                                        keyboardType="number-pad"
                                        containerStyle={styles.field}
                                    />
                                    <Input
                                        label={t("exercise.quickAdd.sets")}
                                        value={sets}
                                        onChangeText={setSets}
                                        keyboardType="number-pad"
                                        containerStyle={styles.field}
                                    />
                                </View>
                            )}

                            {/* Cardio fields */}
                            {template && isCardio && (
                                <View style={styles.fieldGroup}>
                                    <Input
                                        label={t("exercise.exerciseCard.duration") + " (min)"}
                                        value={durationMin}
                                        onChangeText={setDurationMin}
                                        keyboardType="decimal-pad"
                                        containerStyle={styles.field}
                                    />
                                    <Input
                                        label={t("exercise.exerciseCard.distance") + " (km)"}
                                        value={distance}
                                        onChangeText={setDistance}
                                        keyboardType="decimal-pad"
                                        containerStyle={styles.field}
                                    />
                                </View>
                            )}

                            <Button
                                title={t("exercise.quickAdd.save")}
                                onPress={handleSave}
                                disabled={!canSave}
                                style={styles.saveBtn}
                            />
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            <AddExerciseModal
                visible={showPicker}
                onClose={() => setShowPicker(false)}
                onSelect={(tmpl) => { setTemplate(tmpl); setShowPicker(false); }}
            />
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
        },
        sheet: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.lg,
            borderTopRightRadius: borderRadius.lg,
            padding: spacing.lg,
            maxHeight: "70%",
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        pickerBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            marginBottom: spacing.md,
        },
        pickerText: {
            fontSize: fontSize.sm,
            color: colors.text,
        },
        pickerPlaceholder: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
        },
        fieldGroup: {
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        field: {
            marginBottom: 0,
        },
        saveBtn: {
            marginTop: spacing.sm,
        },
    });
}
