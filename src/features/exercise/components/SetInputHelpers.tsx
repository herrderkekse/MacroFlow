import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { parseCustomValues, type CustomField, type CustomValues } from "../helpers/customFields";
import type { ExerciseSet } from "../services/exerciseDb";

type ExerciseType = "weight" | "bodyweight" | "cardio" | "other";

export function ScheduledCells({ set, exerciseType, customFields, textColor, styles }: {
    set: ExerciseSet; exerciseType: ExerciseType; customFields: CustomField[]; textColor: string;
    styles: ReturnType<typeof createSetInputStyles>;
}) {
    const useCustom = exerciseType === "other" && customFields.length > 0;
    if (useCustom) {
        return <CustomReadonlyCells fields={customFields} values={parseCustomValues(set.custom_values)} textColor={textColor} styles={styles} />;
    }
    return (
        <>
            {exerciseType === "weight" && (
                <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                    {set.weight != null ? `${set.weight} ${set.weight_unit}` : "—"}
                </Text>
            )}
            {exerciseType !== "cardio" && (
                <Text style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                    {set.reps ?? "—"}
                </Text>
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
                <Text style={[styles.setCell, styles.rirCol, { color: textColor }]}>
                    {set.rir ?? "—"}
                </Text>
            )}
        </>
    );
}

/** Read-only display of a set's custom field values (one flex cell per field). */
export function CustomReadonlyCells({ fields, values, textColor, styles }: {
    fields: CustomField[]; values: CustomValues; textColor: string;
    styles: { setCell: object; valueCol: object };
}) {
    return (
        <>
            {fields.map((f) => (
                <Text key={f.id} style={[styles.setCell, styles.valueCol, { color: textColor }]}>
                    {values[f.id] != null ? `${values[f.id]}${f.unit ? ` ${f.unit}` : ""}` : "—"}
                </Text>
            ))}
        </>
    );
}

/** Editable inputs for a set's custom fields (one per field), used in active/completed rows. */
export function CustomEditableCells({ fields, inputs, cleared, prefill, focusedField, textColor, placeholderColor, onFocusField, onChangeField, onBlurField, styles }: {
    fields: CustomField[];
    inputs: Record<string, string>;
    cleared: Partial<Record<string, boolean>>;
    prefill: CustomValues;
    focusedField: string | null;
    textColor: string;
    placeholderColor: string;
    onFocusField: (key: string) => void;
    onChangeField: (id: string, text: string) => void;
    onBlurField: (key: string) => void;
    styles: ReturnType<typeof createSetInputStyles>;
}) {
    return (
        <>
            {fields.map((f) => {
                const key = `cf_${f.id}`;
                const showPrefill = !cleared[f.id] && prefill[f.id] != null;
                return (
                    <TextInput
                        key={f.id}
                        style={[focusedField === key ? styles.input : styles.inlineInput, styles.valueCol, { color: textColor }]}
                        value={inputs[f.id] ?? ""}
                        onChangeText={(text) => onChangeField(f.id, text)}
                        placeholder={showPrefill ? String(prefill[f.id]) : "—"}
                        placeholderTextColor={placeholderColor}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        onFocus={() => onFocusField(key)}
                        onBlur={() => onBlurField(key)}
                    />
                );
            })}
        </>
    );
}

export function createSetInputStyles(colors: ThemeColors) {
    return StyleSheet.create({
        setRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: 44,
            paddingVertical: 2,
            // The card has no side padding of its own, so the active band can
            // reach its edges; every other row keeps the inset here.
            marginHorizontal: spacing.md,
        },
        divider: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        // The set to do next: a band across the whole card.
        activeRow: {
            backgroundColor: colors.background,
            marginHorizontal: 0,
            paddingHorizontal: spacing.md,
            marginVertical: spacing.xs,
        },
        setRowScheduled: {
            opacity: 0.6,
        },
        setCell: {
            fontSize: fontSize.sm,
            fontWeight: "600",
        },
        setLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
        },
        setCol: { width: 30, justifyContent: "center" },
        valueCol: { flex: 1, textAlign: "center" },
        rirCol: { width: 40, textAlign: "center" },
        checkCol: { width: 30, alignItems: "center", justifyContent: "center" },
        confirm: {
            width: 28,
            height: 28,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },
        input: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            textAlign: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.primary,
            paddingVertical: 2,
            marginHorizontal: 2,
        },
        inlineInput: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            textAlign: "center",
            paddingVertical: 2,
            marginHorizontal: 2,
        },
        weightInputGroup: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
        },
        weightInput: {
            textAlign: "right",
            minWidth: 44,
        },
        unitToggle: {
            paddingLeft: 3,
            paddingVertical: 2,
            minWidth: 22,
        },
        unitText: {
            fontSize: fontSize.xs,
            fontWeight: "600",
        },
    });
}
