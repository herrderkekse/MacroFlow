import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ExerciseSet } from "../services/exerciseDb";

type ExerciseType = "weight" | "bodyweight" | "cardio";

const SET_TYPES = ["warmup", "working", "dropset", "failure"] as const;
type SetType = (typeof SET_TYPES)[number];

const SET_TYPE_LABELS: Record<SetType, string> = {
    warmup: "W", working: "", dropset: "D", failure: "F",
};

interface SetInputRowProps {
    set: ExerciseSet;
    index: number;
    exerciseType: ExerciseType;
    isActive: boolean;
    isFinished: boolean;
    prefillWeight: number | null;
    prefillReps: number | null;
    prefillRir: number | null;
    prefillDuration: number | null;
    prefillDistance: number | null;
    onConfirm: (id: number, values: SetValues) => void;
    onDelete: (id: number) => void;
    onTypeChange: (id: number, type: string) => void;
}

export interface SetValues {
    weight: number | null;
    weight_unit: string;
    reps: number | null;
    rir: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
    type: string;
}

export default function SetInputRow({
    set, index, exerciseType, isActive, isFinished,
    prefillWeight, prefillReps, prefillRir, prefillDuration, prefillDistance,
    onConfirm, onDelete, onTypeChange,
}: SetInputRowProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const isCompleted = !!set.completed_at;
    const isScheduled = !!set.is_scheduled && !isCompleted;

    // Input state — initialise from set data, placeholders from prefill
    const [weight, setWeight] = useState(set.weight != null ? String(set.weight) : "");
    const [reps, setReps] = useState(set.reps != null ? String(set.reps) : "");
    const [rir, setRir] = useState(set.rir != null ? String(set.rir) : "");
    const [duration, setDuration] = useState(set.duration_seconds != null ? String(set.duration_seconds) : "");
    const [distance, setDistance] = useState(set.distance_meters != null ? String(set.distance_meters) : "");
    const [unit] = useState(set.weight_unit ?? "kg");

    const typeLabel = SET_TYPE_LABELS[set.type as SetType] ?? "";

    const handleConfirm = useCallback(() => {
        const vals: SetValues = {
            weight: weight ? parseFloat(weight) : prefillWeight,
            weight_unit: unit,
            reps: reps ? parseInt(reps, 10) : prefillReps,
            rir: rir ? parseInt(rir, 10) : prefillRir,
            duration_seconds: duration ? parseInt(duration, 10) : prefillDuration,
            distance_meters: distance ? parseFloat(distance) : prefillDistance,
            type: set.type,
        };
        onConfirm(set.id, vals);
    }, [weight, reps, rir, duration, distance, unit, set.id, set.type,
        prefillWeight, prefillReps, prefillRir, prefillDuration, prefillDistance, onConfirm]);

    const handleLongPressSetNum = useCallback(() => {
        if (isCompleted || isFinished) return;
        const currentIdx = SET_TYPES.indexOf(set.type as SetType);
        const nextIdx = (currentIdx + 1) % SET_TYPES.length;
        onTypeChange(set.id, SET_TYPES[nextIdx]);
    }, [set.id, set.type, isCompleted, isFinished, onTypeChange]);

    const handleDelete = useCallback(() => {
        if (isFinished) return;
        Alert.alert(
            t("common.delete"),
            t("exercise.exerciseCard.removeConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: () => onDelete(set.id) },
            ],
        );
    }, [set.id, isFinished, onDelete, t]);

    // Completed / read-only display
    if (isCompleted && !isActive) {
        return (
            <Pressable style={styles.setRow} onLongPress={handleDelete} delayLongPress={600}>
                <Text style={[styles.setCell, styles.setCol, { color: colors.textSecondary }]}>
                    {typeLabel}{index + 1}
                </Text>
                <ReadOnlyCells set={set} exerciseType={exerciseType} textColor={colors.textSecondary} styles={styles} />
                <View style={styles.checkCol}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                </View>
            </Pressable>
        );
    }

    // Active / editable input row
    if (isActive && !isFinished) {
        const textColor = isScheduled ? colors.textTertiary : colors.text;
        return (
            <View style={[styles.setRow, styles.activeRow]}>
                <Pressable onLongPress={handleLongPressSetNum} style={styles.setCol}>
                    <Text style={[styles.setCell, { color: colors.primary, fontWeight: "700" }]}>
                        {typeLabel}{index + 1}
                    </Text>
                </Pressable>
                {exerciseType === "weight" && (
                    <TextInput
                        style={[styles.input, styles.valueCol, { color: textColor }]}
                        value={weight}
                        onChangeText={setWeight}
                        placeholder={prefillWeight != null ? String(prefillWeight) : "—"}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                    />
                )}
                {exerciseType !== "cardio" && (
                    <TextInput
                        style={[styles.input, styles.valueCol, { color: textColor }]}
                        value={reps}
                        onChangeText={setReps}
                        placeholder={prefillReps != null ? String(prefillReps) : "—"}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        selectTextOnFocus
                    />
                )}
                {exerciseType === "cardio" && (
                    <>
                        <TextInput
                            style={[styles.input, styles.valueCol, { color: textColor }]}
                            value={duration}
                            onChangeText={setDuration}
                            placeholder={prefillDuration != null ? String(prefillDuration) : "—"}
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="number-pad"
                            selectTextOnFocus
                        />
                        <TextInput
                            style={[styles.input, styles.valueCol, { color: textColor }]}
                            value={distance}
                            onChangeText={setDistance}
                            placeholder={prefillDistance != null ? String(prefillDistance) : "—"}
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                        />
                    </>
                )}
                {exerciseType !== "cardio" && (
                    <TextInput
                        style={[styles.input, styles.rirCol, { color: textColor }]}
                        value={rir}
                        onChangeText={setRir}
                        placeholder={prefillRir != null ? String(prefillRir) : "—"}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        selectTextOnFocus
                    />
                )}
                <Pressable style={styles.checkCol} onPress={handleConfirm}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
                </Pressable>
            </View>
        );
    }

    // Scheduled / pending (not active) — display-only dim row
    const textColor = isScheduled ? colors.textTertiary : colors.text;
    return (
        <Pressable
            style={[styles.setRow, isScheduled && styles.setRowScheduled]}
            onLongPress={handleLongPressSetNum}
        >
            <Text style={[styles.setCell, styles.setCol, { color: textColor }]}>{typeLabel}{index + 1}</Text>
            <ReadOnlyCells set={set} exerciseType={exerciseType} textColor={textColor} styles={styles} />
            <View style={styles.checkCol}>
                <Ionicons name="ellipse-outline" size={20} color={colors.border} />
            </View>
        </Pressable>
    );
}

function ReadOnlyCells({ set, exerciseType, textColor, styles }: {
    set: ExerciseSet; exerciseType: ExerciseType; textColor: string;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <>
            {exerciseType === "weight" && (
                <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>{set.weight ?? "—"}</Text>
            )}
            {exerciseType !== "cardio" && (
                <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>{set.reps ?? "—"}</Text>
            )}
            {exerciseType === "cardio" && (
                <>
                    <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                        {set.duration_seconds ? `${set.duration_seconds}s` : "—"}
                    </Text>
                    <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                        {set.distance_meters ? `${set.distance_meters}m` : "—"}
                    </Text>
                </>
            )}
            {exerciseType !== "cardio" && (
                <Text style={[styles.setCell, styles.rirCol, { color: textColor }]}>{set.rir ?? "—"}</Text>
            )}
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        setRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 4,
        },
        activeRow: {
            backgroundColor: colors.surfaceVariant ?? colors.background,
            borderRadius: borderRadius.sm,
            marginHorizontal: -spacing.xs,
            paddingHorizontal: spacing.xs,
        },
        setRowScheduled: {
            opacity: 0.6,
        },
        setCell: {
            fontSize: fontSize.sm,
        },
        setCol: { width: 32, justifyContent: "center" },
        valueCol: { flex: 1, textAlign: "center" },
        rirCol: { width: 36, textAlign: "center" },
        checkCol: { width: 28, alignItems: "center" },
        input: {
            fontSize: fontSize.sm,
            textAlign: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: 2,
            marginHorizontal: 2,
        },
    });
}
