import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import type { ExerciseSet } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { ScheduledCells, createSetInputStyles } from "./SetInputHelpers";

const SET_TYPES = ["warmup", "working", "dropset", "failure"] as const;
type SetType = (typeof SET_TYPES)[number];

const SET_TYPE_LABELS: Record<SetType, string> = {
    warmup: "W", working: "", dropset: "D", failure: "F",
};

interface SetInputRowProps {
    set: ExerciseSet; index: number; exerciseType: ExerciseType;
    isActive: boolean; isFinished: boolean;
    prefillWeight: number | null; prefillReps: number | null; prefillRir: number | null;
    prefillDuration: number | null; prefillDistance: number | null;
    onConfirm: (id: number, values: SetValues) => void;
    onUpdate: (id: number, values: SetValues) => void;
    onDelete: (id: number) => void;
    onTypeChange: (id: number, type: string) => void;
    onDragStart?: () => void;
}

export type { SetValues } from "../types";

export default function SetInputRow({
    set, index, exerciseType, isActive, isFinished,
    prefillWeight, prefillReps, prefillRir, prefillDuration, prefillDistance,
    onConfirm, onUpdate, onDelete, onTypeChange, onDragStart,
}: SetInputRowProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createSetInputStyles(colors), [colors]);

    const isCompleted = !!set.completed_at;
    const isScheduled = !!set.is_scheduled && !isCompleted;
    const isActiveSet = isActive && !isFinished;

    const [weight, setWeight] = useState(set.weight != null ? String(set.weight) : "");
    const [reps, setReps] = useState(set.reps != null ? String(set.reps) : "");
    const [rir, setRir] = useState(set.rir != null ? String(set.rir) : "");
    const [duration, setDuration] = useState(set.duration_seconds != null ? String(set.duration_seconds) : "");
    const [distance, setDistance] = useState(set.distance_meters != null ? String(set.distance_meters) : "");
    const [unit, setUnit] = useState<"kg" | "lb">((set.weight_unit as "kg" | "lb") ?? "kg");
    const [focusedField, setFocusedField] = useState<string | null>(null);
    // Tracks fields the user has explicitly cleared; used to distinguish "never set" (show prefill)
    // from "intentionally cleared" (show "—" and save null). Reset when navigating to a new set.
    const [clearedFields, setClearedFields] = useState<Partial<Record<"weight" | "reps" | "rir" | "duration" | "distance", boolean>>>({});

    // Sync input state from DB when set values change (e.g., after a save)
    useEffect(() => {
        setWeight(set.weight != null ? String(set.weight) : "");
        setReps(set.reps != null ? String(set.reps) : "");
        setRir(set.rir != null ? String(set.rir) : "");
        setDuration(set.duration_seconds != null ? String(set.duration_seconds) : "");
        setDistance(set.distance_meters != null ? String(set.distance_meters) : "");
        setUnit((set.weight_unit as "kg" | "lb") ?? "kg");
    }, [set.id, set.weight, set.reps, set.rir, set.duration_seconds, set.distance_meters, set.weight_unit]);

    // Reset cleared-field tracking only when switching to a different set
    useEffect(() => {
        setClearedFields({});
    }, [set.id]);

    const typeLabel = SET_TYPE_LABELS[set.type as SetType] ?? "";

    const buildValues = useCallback((): SetValues => ({
        weight: weight ? parseFloat(weight) : (clearedFields.weight ? null : prefillWeight),
        weight_unit: unit,
        reps: reps ? parseInt(reps, 10) : (clearedFields.reps ? null : prefillReps),
        rir: rir ? parseInt(rir, 10) : (clearedFields.rir ? null : prefillRir),
        duration_seconds: duration ? parseInt(duration, 10) : (clearedFields.duration ? null : prefillDuration),
        distance_meters: distance ? parseFloat(distance) : (clearedFields.distance ? null : prefillDistance),
        type: set.type,
    }), [weight, reps, rir, duration, distance, unit, set.type, clearedFields,
        prefillWeight, prefillReps, prefillRir, prefillDuration, prefillDistance]);

    const handleToggleUnit = useCallback(() => {
        const newUnit = unit === "kg" ? "lb" : "kg";
        setUnit(newUnit);
        onUpdate(set.id, { ...buildValues(), weight_unit: newUnit });
    }, [unit, set.id, buildValues, onUpdate]);

    const handleConfirm = useCallback(() => {
        onConfirm(set.id, buildValues());
    }, [set.id, buildValues, onConfirm]);

    const handleBlurSave = useCallback((field: string) => {
        setFocusedField((prev) => (prev === field ? null : prev));
        onUpdate(set.id, buildValues());
    }, [set.id, buildValues, onUpdate]);

    const handleLongPressSetNum = useCallback(() => {
        if (isCompleted) return;
        const currentIdx = SET_TYPES.indexOf(set.type as SetType);
        const nextIdx = (currentIdx + 1) % SET_TYPES.length;
        onTypeChange(set.id, SET_TYPES[nextIdx]);
    }, [set.id, set.type, isCompleted, onTypeChange]);

    const handleDelete = useCallback(() => {
        Alert.alert(
            t("exercise.exerciseCard.deleteSet"),
            t("exercise.exerciseCard.deleteSetConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: () => onDelete(set.id) },
            ],
        );
    }, [set.id, onDelete, t]);

    // Scheduled / pending — display-only dim row
    if (isScheduled && !isActive) {
        return (
            <Pressable style={[styles.setRow, styles.setRowScheduled]} onLongPress={handleLongPressSetNum}>
                <Pressable style={styles.handleCol} onLongPress={onDragStart} hitSlop={8}>
                    <Ionicons name="reorder-two-outline" size={16} color={colors.textTertiary} />
                </Pressable>
                <Text style={[styles.setCell, styles.setCol, { color: colors.textTertiary }]}>
                    {typeLabel}{index + 1}
                </Text>
                <ScheduledCells set={set} exerciseType={exerciseType} textColor={colors.textTertiary} styles={styles} />
                <Pressable style={styles.checkCol} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                </Pressable>
            </Pressable>
        );
    }

    // Editable row — completed and active sets
    const textColor = isActiveSet ? colors.text : colors.textSecondary;
    const fieldStyle = (field: string) => focusedField === field ? styles.input : styles.inlineInput;

    return (
        <View style={[styles.setRow, isActiveSet && styles.activeRow]}>
            <Pressable style={styles.handleCol} onLongPress={onDragStart} hitSlop={8}>
                <Ionicons name="reorder-two-outline" size={16} color={colors.textTertiary} />
            </Pressable>
            <Pressable onLongPress={handleLongPressSetNum} style={styles.setCol}>
                <Text style={[
                    styles.setCell,
                    { color: isActiveSet ? colors.primary : textColor },
                    isActiveSet && { fontWeight: "700" },
                ]}>
                    {typeLabel}{index + 1}
                </Text>
            </Pressable>

            {exerciseType === "weight" && (
                <View style={styles.weightInputGroup}>
                    <TextInput
                        style={[fieldStyle("weight"), styles.weightInput, { color: textColor }]}
                        value={weight}
                        onChangeText={(text) => {
                            setWeight(text);
                            setClearedFields(prev => ({ ...prev, weight: text === "" }));
                        }}
                        placeholder={!clearedFields.weight && prefillWeight != null ? String(prefillWeight) : "—"}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        onFocus={() => setFocusedField("weight")}
                        onBlur={() => handleBlurSave("weight")}
                    />
                    <Pressable onPress={handleToggleUnit} style={styles.unitToggle}>
                        <Text style={[styles.unitText, { color: colors.primary }]}>{unit}</Text>
                    </Pressable>
                </View>
            )}

            {exerciseType !== "cardio" && (
                <TextInput
                    style={[fieldStyle("reps"), styles.valueCol, { color: textColor }]}
                    value={reps}
                    onChangeText={(text) => {
                        setReps(text);
                        setClearedFields(prev => ({ ...prev, reps: text === "" }));
                    }}
                    placeholder={!clearedFields.reps && prefillReps != null ? String(prefillReps) : "—"}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    onFocus={() => setFocusedField("reps")}
                    onBlur={() => handleBlurSave("reps")}
                />
            )}

            {exerciseType === "cardio" && (
                <>
                    <TextInput
                        style={[fieldStyle("duration"), styles.valueCol, { color: textColor }]}
                        value={duration}
                        onChangeText={(text) => {
                            setDuration(text);
                            setClearedFields(prev => ({ ...prev, duration: text === "" }));
                        }}
                        placeholder={!clearedFields.duration && prefillDuration != null ? String(prefillDuration) : "—"}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        onFocus={() => setFocusedField("duration")}
                        onBlur={() => handleBlurSave("duration")}
                    />
                    <TextInput
                        style={[fieldStyle("distance"), styles.valueCol, { color: textColor }]}
                        value={distance}
                        onChangeText={(text) => {
                            setDistance(text);
                            setClearedFields(prev => ({ ...prev, distance: text === "" }));
                        }}
                        placeholder={!clearedFields.distance && prefillDistance != null ? String(prefillDistance) : "—"}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        onFocus={() => setFocusedField("distance")}
                        onBlur={() => handleBlurSave("distance")}
                    />
                </>
            )}

            {exerciseType !== "cardio" && (
                <TextInput
                    style={[fieldStyle("rir"), styles.rirCol, { color: textColor }]}
                    value={rir}
                    onChangeText={(text) => {
                        setRir(text);
                        setClearedFields(prev => ({ ...prev, rir: text === "" }));
                    }}
                    placeholder={!clearedFields.rir && prefillRir != null ? String(prefillRir) : "—"}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    onFocus={() => setFocusedField("rir")}
                    onBlur={() => handleBlurSave("rir")}
                />
            )}

            {isActiveSet ? (
                <Pressable style={styles.checkCol} onPress={handleConfirm}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                </Pressable>
            ) : (
                <Pressable style={styles.checkCol} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                </Pressable>
            )}
        </View>
    );
}
