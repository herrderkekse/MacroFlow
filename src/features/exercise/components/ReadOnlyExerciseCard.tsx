import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { parseCustomFields, parseCustomValues, type CustomField } from "../helpers/customFields";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { SET_TYPE_LABELS, type SetType } from "./ExerciseCardHelpers";
import { CustomReadonlyCells, createSetInputStyles } from "./SetInputHelpers";
import { NoSetsLine, ReadOnlyCardFrame, SetColumns } from "./WorkoutCardParts";

interface ReadOnlyExerciseCardProps {
    item: WorkoutExerciseWithSets;
}

/**
 * The completed sets of one past session, drawn like an open card in the workout
 * but with nothing to act on: no title, no add-set bar, no check or trash column.
 * Its date and workout are the section heading above it.
 */
export default function ReadOnlyExerciseCard({ item }: ReadOnlyExerciseCardProps) {
    const exerciseType: ExerciseType = (item.exerciseTemplate?.type as ExerciseType) ?? "weight";
    const customFields = parseCustomFields(item.exerciseTemplate?.custom_fields);
    const completedSets = item.sets.filter((s) => !!s.completed_at);

    return (
        <ReadOnlyCardFrame>
            <SetColumns exerciseType={exerciseType} customFields={customFields} withActionColumn={false} />
            {completedSets.map((set, i) => (
                <ReadOnlySetRow key={set.id} set={set} index={i} exerciseType={exerciseType} customFields={customFields} />
            ))}
            {completedSets.length === 0 && <NoSetsLine />}
        </ReadOnlyCardFrame>
    );
}

/** A completed `SetInputRow`, with its values as text instead of inputs. */
function ReadOnlySetRow({ set, index, exerciseType, customFields }: {
    set: ExerciseSet; index: number; exerciseType: ExerciseType; customFields: CustomField[];
}) {
    const colors = useThemeColors();
    const styles = useMemo(() => createSetInputStyles(colors), [colors]);
    const useCustom = exerciseType === "other" && customFields.length > 0;
    const value = [styles.inlineInput, { color: colors.text }];
    const label = `${SET_TYPE_LABELS[set.type as SetType] ?? ""}${index + 1}`;

    return (
        <View style={[styles.setRow, index > 0 && styles.divider]}>
            <View style={styles.setCol}>
                <Text style={[styles.setLabel, { color: colors.textSecondary }]}>{label}</Text>
            </View>

            {exerciseType === "weight" && (
                <View style={styles.weightInputGroup}>
                    <Text style={[value, styles.weightInput]}>{set.weight ?? "—"}</Text>
                    <View style={styles.unitToggle}>
                        <Text style={[styles.unitText, { color: colors.textTertiary }]}>{set.weight_unit}</Text>
                    </View>
                </View>
            )}

            {exerciseType !== "cardio" && !useCustom && (
                <Text style={[value, styles.valueCol]}>{set.reps ?? "—"}</Text>
            )}

            {exerciseType === "cardio" && (
                <>
                    <Text style={[value, styles.valueCol]}>{set.duration_seconds ?? "—"}</Text>
                    <Text style={[value, styles.valueCol]}>{set.distance_meters ?? "—"}</Text>
                </>
            )}

            {useCustom && (
                <CustomReadonlyCells
                    fields={customFields}
                    values={parseCustomValues(set.custom_values)}
                    textColor={colors.text}
                    styles={styles}
                />
            )}

            {exerciseType !== "cardio" && !useCustom && (
                <Text style={[value, styles.rirCol]}>{set.rir ?? "—"}</Text>
            )}
        </View>
    );
}
