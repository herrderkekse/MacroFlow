import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
    copyWorkoutAsScheduled,
    getExercisesForWorkout,
    getRecentWorkouts,
    type Workout,
} from "../services/exerciseDb";

interface CopyWorkoutSheetProps {
    visible: boolean;
    targetWorkoutId: number;
    onClose: () => void;
    onCopied: () => void;
}

interface WorkoutRow {
    workout: Workout;
    exerciseCount: number;
}

export default function CopyWorkoutSheet({ visible, targetWorkoutId, onClose, onCopied }: CopyWorkoutSheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [rows, setRows] = useState<WorkoutRow[]>([]);

    useEffect(() => {
        if (!visible) return;
        const recents = getRecentWorkouts(20);
        const filtered = recents.filter((w) => w.id !== targetWorkoutId && w.ended_at !== null);
        setRows(filtered.map((w) => ({
            workout: w,
            exerciseCount: getExercisesForWorkout(w.id).length,
        })));
    }, [visible, targetWorkoutId]);

    function handleCopy(sourceId: number) {
        copyWorkoutAsScheduled(sourceId, targetWorkoutId);
        onCopied();
        onClose();
    }

    function formatDate(dateStr: string): string {
        const [y, m, d] = dateStr.split("-");
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        return dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => { }}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t("exercise.copyWorkout.title")}</Text>
                        <Pressable onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    {rows.length === 0 ? (
                        <Text style={styles.emptyText}>{t("exercise.copyWorkout.noWorkouts")}</Text>
                    ) : (
                        <>
                            <Text style={styles.subtitle}>{t("exercise.copyWorkout.subtitle")}</Text>
                            <FlatList
                                data={rows}
                                keyExtractor={(item) => String(item.workout.id)}
                                renderItem={({ item }) => (
                                    <Pressable style={styles.row} onPress={() => handleCopy(item.workout.id)}>
                                        <Text style={styles.rowDate}>{formatDate(item.workout.date)}</Text>
                                        <Text style={styles.rowTitle} numberOfLines={1}>
                                            {item.workout.title || t("exercise.workout.defaultTitle")}
                                        </Text>
                                        <Text style={styles.rowCount}>
                                            {t("exercise.copyWorkout.exercises", { count: item.exerciseCount })}
                                        </Text>
                                    </Pressable>
                                )}
                                style={styles.list}
                            />
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
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
            maxHeight: "60%",
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        subtitle: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        list: {
            flexGrow: 0,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        rowDate: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            width: 50,
        },
        rowTitle: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
        },
        rowCount: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
        },
        emptyText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            textAlign: "center",
            paddingVertical: spacing.lg,
        },
    });
}
