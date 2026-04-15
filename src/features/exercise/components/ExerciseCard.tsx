import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";

type ExerciseType = "weight" | "bodyweight" | "cardio";

interface ExerciseCardProps {
    item: WorkoutExerciseWithSets;
    index: number;
    totalExercises: number;
    isFinished: boolean;
    onRemove: (workoutExerciseId: number) => void;
    onMoveUp: (workoutExerciseId: number) => void;
    onMoveDown: (workoutExerciseId: number) => void;
    onNoteChange: (workoutExerciseId: number, note: string) => void;
}

export default function ExerciseCard({
    item, index, totalExercises, isFinished,
    onRemove, onMoveUp, onMoveDown, onNoteChange,
}: ExerciseCardProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState(item.workoutExercise.notes ?? "");

    const template = item.exerciseTemplate;
    const name = template?.name ?? "?";
    const exerciseType: ExerciseType = template?.type === "cardio" ? "cardio"
        : template?.type === "bodyweight" ? "bodyweight" : "weight";

    function handleRemove() {
        Alert.alert(
            t("exercise.exerciseCard.remove"),
            t("exercise.exerciseCard.removeConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: () => onRemove(item.workoutExercise.id) },
            ],
        );
        setMenuOpen(false);
    }

    function handleHistory() {
        if (template) {
            router.push({
                pathname: "/workout/exercise-history",
                params: { templateId: String(template.id), name: template.name },
            });
        }
    }

    function handleSaveNote() {
        onNoteChange(item.workoutExercise.id, noteDraft.trim());
        setNoteOpen(false);
    }

    return (
        <View style={styles.card}>
            {/* Title row */}
            <View style={styles.titleRow}>
                <Text style={styles.orderNum}>{index + 1}.</Text>
                <Text style={styles.exerciseName} numberOfLines={1}>{name}</Text>
                <Pressable onPress={handleHistory} hitSlop={8}>
                    <Ionicons name="bar-chart-outline" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
                    <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                </Pressable>
            </View>

            {/* Note display */}
            {item.workoutExercise.notes ? (
                <Text style={styles.noteText} numberOfLines={2}>
                    {item.workoutExercise.notes}
                </Text>
            ) : null}

            {/* Column headers */}
            <View style={styles.headerRow}>
                <Text style={[styles.headerCell, styles.setCol]}>{t("exercise.exerciseCard.set")}</Text>
                {exerciseType === "weight" && (
                    <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.weight")}</Text>
                )}
                {exerciseType !== "cardio" && (
                    <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.reps")}</Text>
                )}
                {exerciseType === "cardio" && (
                    <>
                        <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.duration")}</Text>
                        <Text style={[styles.headerCell, styles.valueCol]}>{t("exercise.exerciseCard.distance")}</Text>
                    </>
                )}
                {exerciseType !== "cardio" && (
                    <Text style={[styles.headerCell, styles.rirCol]}>{t("exercise.exerciseCard.rir")}</Text>
                )}
                <Text style={[styles.headerCell, styles.checkCol]}>✓</Text>
            </View>

            {/* Set rows */}
            {item.sets.map((set, si) => (
                <SetRow key={set.id} set={set} index={si} exerciseType={exerciseType} colors={colors} styles={styles} />
            ))}

            {/* Empty state */}
            {item.sets.length === 0 && (
                <Text style={styles.emptyText}>{t("exercise.workout.emptyState")}</Text>
            )}

            {/* Overflow menu modal */}
            <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
                <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
                    <View style={styles.menu}>
                        {index > 0 && (
                            <MenuItem label={t("exercise.exerciseCard.moveUp")} icon="arrow-up"
                                onPress={() => { onMoveUp(item.workoutExercise.id); setMenuOpen(false); }} colors={colors} />
                        )}
                        {index < totalExercises - 1 && (
                            <MenuItem label={t("exercise.exerciseCard.moveDown")} icon="arrow-down"
                                onPress={() => { onMoveDown(item.workoutExercise.id); setMenuOpen(false); }} colors={colors} />
                        )}
                        <MenuItem
                            label={item.workoutExercise.notes ? t("exercise.exerciseCard.editNote") : t("exercise.exerciseCard.addNote")}
                            icon="create-outline"
                            onPress={() => { setMenuOpen(false); setNoteDraft(item.workoutExercise.notes ?? ""); setNoteOpen(true); }} colors={colors} />
                        {!isFinished && (
                            <MenuItem label={t("exercise.exerciseCard.remove")} icon="trash-outline"
                                onPress={handleRemove} colors={colors} destructive />
                        )}
                    </View>
                </Pressable>
            </Modal>

            {/* Note edit modal */}
            <Modal visible={noteOpen} transparent animationType="fade" onRequestClose={() => setNoteOpen(false)}>
                <Pressable style={styles.overlay} onPress={() => setNoteOpen(false)}>
                    <Pressable style={styles.noteModal} onPress={() => { }}>
                        <Text style={styles.noteTitle}>{t("exercise.exerciseCard.note")}</Text>
                        <TextInput
                            style={styles.noteInput}
                            value={noteDraft}
                            onChangeText={setNoteDraft}
                            placeholder={t("exercise.exerciseCard.notePlaceholder")}
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            autoFocus
                        />
                        <Pressable style={styles.noteSaveBtn} onPress={handleSaveNote}>
                            <Text style={styles.noteSaveText}>{t("common.save")}</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

function SetRow({ set, index, exerciseType, colors, styles }: {
    set: ExerciseSet; index: number; exerciseType: ExerciseType;
    colors: ReturnType<typeof useThemeColors>; styles: ReturnType<typeof createStyles>;
}) {
    const isCompleted = !!set.completed_at;
    const isScheduled = !!set.is_scheduled && !isCompleted;
    const textColor = isScheduled ? colors.textTertiary : colors.text;

    function formatWeight(w: number | null): string {
        if (w === null) return "—";
        return `${w}`;
    }

    return (
        <View style={[styles.setRow, isScheduled && styles.setRowScheduled]}>
            <Text style={[styles.setCell, styles.setCol, { color: textColor }]}>{index + 1}</Text>
            {exerciseType === "weight" && (
                <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>{formatWeight(set.weight)}</Text>
            )}
            {exerciseType !== "cardio" && (
                <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>{set.reps ?? "—"}</Text>
            )}
            {exerciseType === "cardio" && (
                <>
                    <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>{set.duration_seconds ? `${set.duration_seconds}s` : "—"}</Text>
                    <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>{set.distance_meters ? `${set.distance_meters}m` : "—"}</Text>
                </>
            )}
            {exerciseType !== "cardio" && (
                <Text style={[styles.setCell, styles.rirCol, { color: textColor }]}>{set.rir ?? "—"}</Text>
            )}
            <View style={styles.checkCol}>
                <Ionicons
                    name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={isCompleted ? colors.primary : isScheduled ? colors.textTertiary : colors.border}
                />
            </View>
        </View>
    );
}

function MenuItem({ label, icon, onPress, colors, destructive }: {
    label: string; icon: string; onPress: () => void;
    colors: ReturnType<typeof useThemeColors>; destructive?: boolean;
}) {
    return (
        <Pressable style={menuItemStyles.item} onPress={onPress}>
            <Ionicons name={icon as never} size={20} color={destructive ? "#ef4444" : colors.text} />
            <Text style={[menuItemStyles.label, { color: destructive ? "#ef4444" : colors.text }]}>{label}</Text>
        </Pressable>
    );
}

const menuItemStyles = StyleSheet.create({
    item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    label: { fontSize: fontSize.sm },
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        orderNum: {
            fontSize: fontSize.sm,
            fontWeight: "700",
            color: colors.textSecondary,
        },
        exerciseName: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
        },
        noteText: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            fontStyle: "italic",
            marginBottom: spacing.sm,
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingBottom: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: spacing.xs,
        },
        headerCell: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
        },
        setRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 4,
        },
        setRowScheduled: {
            opacity: 0.6,
        },
        setCell: {
            fontSize: fontSize.sm,
        },
        setCol: { width: 32 },
        valueCol: { flex: 1, textAlign: "center" },
        rirCol: { width: 36, textAlign: "center" },
        checkCol: { width: 28, alignItems: "center" },
        emptyText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            textAlign: "center",
            paddingVertical: spacing.md,
        },
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        menu: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            width: "100%",
            maxWidth: 300,
        },
        noteModal: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            width: "100%",
            maxWidth: 340,
        },
        noteTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.md,
        },
        noteInput: {
            fontSize: fontSize.sm,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            minHeight: 80,
            textAlignVertical: "top",
            marginBottom: spacing.md,
        },
        noteSaveBtn: {
            backgroundColor: colors.primary,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm,
            alignItems: "center",
        },
        noteSaveText: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: "#fff",
        },
    });
}
