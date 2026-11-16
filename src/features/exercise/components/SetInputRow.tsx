import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { parseCustomValues, type CustomField, type CustomValues } from "../helpers/customFields";
import type { ExerciseSet } from "../services/exerciseDb";
import type { ExerciseType, SetValues } from "../types";
import { SET_TYPES, SET_TYPE_LABELS, type SetType } from "./ExerciseCardHelpers";
import { CustomEditableCells, ScheduledCells, createSetInputStyles } from "./SetInputHelpers";

interface SetInputRowProps {
    set: ExerciseSet; index: number; exerciseType: ExerciseType;
    /** A superset member's letter, put in front of the set number ("A1"). */
    letter?: string;
    /** The first row draws no divider above it. */
    isFirst?: boolean;
    customFields: CustomField[];
    isActive: boolean; isFinished: boolean;
    prefillWeight: number | null; prefillReps: number | null; prefillRir: number | null;
    prefillDuration: number | null; prefillDistance: number | null;
    prefillCustom: CustomValues;
    onConfirm: (id: number, values: SetValues) => void;
    onUpdate: (id: number, values: SetValues) => void;
    onDelete: (id: number) => void;
    onTypeChange: (id: number, type: string) => void;
    onDragStart?: () => void;
}

export type { SetValues };

function customValuesToInputs(json: string | null | undefined): Record<string, string> {
    const values = parseCustomValues(json);
    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
        if (value != null) inputs[key] = String(value);
    }
    return inputs;
}

export default function SetInputRow({
    set, index, exerciseType, letter = "", isFirst = false, customFields, isActive, isFinished,
    prefillWeight, prefillReps, prefillRir, prefillDuration, prefillDistance, prefillCustom,
    onConfirm, onUpdate, onDelete, onTypeChange, onDragStart,
}: SetInputRowProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createSetInputStyles(colors), [colors]);

    const isCompleted = !!set.completed_at;
    const isScheduled = !!set.is_scheduled && !isCompleted;
    const isActiveSet = isActive && !isFinished;
    const useCustom = exerciseType === "other" && customFields.length > 0;

    const [weight, setWeight] = useState(set.weight != null ? String(set.weight) : "");
    const [reps, setReps] = useState(set.reps != null ? String(set.reps) : "");
    const [rir, setRir] = useState(set.rir != null ? String(set.rir) : "");
    const [duration, setDuration] = useState(set.duration_seconds != null ? String(set.duration_seconds) : "");
    const [distance, setDistance] = useState(set.distance_meters != null ? String(set.distance_meters) : "");
    const [unit, setUnit] = useState<"kg" | "lb">((set.weight_unit as "kg" | "lb") ?? "kg");
    const [customInputs, setCustomInputs] = useState<Record<string, string>>(() => customValuesToInputs(set.custom_values));
    const [focusedField, setFocusedField] = useState<string | null>(null);
    // Tracks fields the user has explicitly cleared; used to distinguish "never set" (show prefill)
    // from "intentionally cleared" (show "—" and save null). Reset when navigating to a new set.
    const [clearedFields, setClearedFields] = useState<Partial<Record<string, boolean>>>({});

    // Sync input state from DB when set values change (e.g., after a save)
    useEffect(() => {
        queueMicrotask(() => {
            setWeight(set.weight != null ? String(set.weight) : "");
            setReps(set.reps != null ? String(set.reps) : "");
            setRir(set.rir != null ? String(set.rir) : "");
            setDuration(set.duration_seconds != null ? String(set.duration_seconds) : "");
            setDistance(set.distance_meters != null ? String(set.distance_meters) : "");
            setCustomInputs(customValuesToInputs(set.custom_values));
            setUnit((set.weight_unit as "kg" | "lb") ?? "kg");
        });
    }, [set.id, set.weight, set.reps, set.rir, set.duration_seconds, set.distance_meters, set.custom_values, set.weight_unit]);

    // Reset cleared-field tracking only when switching to a different set
    useEffect(() => {
        queueMicrotask(() => setClearedFields({}));
    }, [set.id]);

    const typeLabel = SET_TYPE_LABELS[set.type as SetType] ?? "";

    const buildValues = useCallback((): SetValues => {
        const custom_values: CustomValues = {};
        for (const f of customFields) {
            const raw = customInputs[f.id];
            custom_values[f.id] = raw ? parseFloat(raw) : (clearedFields[f.id] ? null : (prefillCustom[f.id] ?? null));
        }
        return {
            weight: weight ? parseFloat(weight) : (clearedFields.weight ? null : prefillWeight),
            weight_unit: unit,
            reps: reps ? parseInt(reps, 10) : (clearedFields.reps ? null : prefillReps),
            rir: rir ? parseInt(rir, 10) : (clearedFields.rir ? null : prefillRir),
            duration_seconds: duration ? parseInt(duration, 10) : (clearedFields.duration ? null : prefillDuration),
            distance_meters: distance ? parseFloat(distance) : (clearedFields.distance ? null : prefillDistance),
            custom_values,
            type: set.type,
        };
    }, [weight, reps, rir, duration, distance, unit, set.type, clearedFields, customFields, customInputs,
        prefillWeight, prefillReps, prefillRir, prefillDuration, prefillDistance, prefillCustom]);

    const handleChangeCustom = useCallback((id: string, text: string) => {
        setCustomInputs((prev) => ({ ...prev, [id]: text }));
        setClearedFields((prev) => ({ ...prev, [id]: text === "" }));
    }, []);

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

    const label = `${letter}${typeLabel}${index + 1}`;

    // Scheduled / pending — display-only dim row
    if (isScheduled && !isActive) {
        return (
            <Pressable
                style={[styles.setRow, !isFirst && styles.divider, styles.setRowScheduled]}
                onLongPress={onDragStart}
                delayLongPress={250}
            >
                <Pressable onLongPress={handleLongPressSetNum} style={styles.setCol} hitSlop={4}>
                    <Text style={[styles.setLabel, { color: colors.textTertiary }]}>{label}</Text>
                </Pressable>
                <ScheduledCells set={set} exerciseType={exerciseType} customFields={customFields} textColor={colors.textTertiary} styles={styles} />
                <Pressable style={styles.checkCol} onPress={handleDelete} hitSlop={6} accessibilityLabel={t("exercise.exerciseCard.deleteSet")}>
                    <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                </Pressable>
            </Pressable>
        );
    }

    // Editable row — completed and active sets
    const textColor = isActiveSet || isCompleted ? colors.text : colors.textTertiary;
    const fieldStyle = (field: string) => focusedField === field ? styles.input : styles.inlineInput;

    return (
        <Pressable
            style={[styles.setRow, isActiveSet ? styles.activeRow : !isFirst && styles.divider]}
            onLongPress={onDragStart}
            delayLongPress={250}
        >
            <Pressable onLongPress={handleLongPressSetNum} style={styles.setCol} hitSlop={4}>
                <Text style={[
                    styles.setLabel,
                    { color: isActiveSet ? colors.text : isCompleted ? colors.textSecondary : colors.textTertiary },
                ]}>
                    {label}
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
                    <Pressable onPress={handleToggleUnit} style={styles.unitToggle} hitSlop={6}>
                        <Text style={[styles.unitText, { color: colors.textTertiary }]}>{unit}</Text>
                    </Pressable>
                </View>
            )}

            {exerciseType !== "cardio" && !useCustom && (
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

            {useCustom && (
                <CustomEditableCells
                    fields={customFields}
                    inputs={customInputs}
                    cleared={clearedFields}
                    prefill={prefillCustom}
                    focusedField={focusedField}
                    textColor={textColor}
                    placeholderColor={colors.textTertiary}
                    onFocusField={setFocusedField}
                    onChangeField={handleChangeCustom}
                    onBlurField={handleBlurSave}
                    styles={styles}
                />
            )}

            {exerciseType !== "cardio" && !useCustom && (
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
                <Pressable
                    style={styles.checkCol}
                    onPress={handleConfirm}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t("exercise.exerciseCard.completeSet")}
                >
                    <View style={styles.confirm}>
                        <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                    </View>
                </Pressable>
            ) : (
                <Pressable
                    style={styles.checkCol}
                    onPress={handleDelete}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t("exercise.exerciseCard.deleteSet")}
                >
                    <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                </Pressable>
            )}
        </Pressable>
    );
}
