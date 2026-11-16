import { useEffect, useState } from "react";
import { parseCustomFields, serializeCustomFields, type CustomField } from "../helpers/customFields";
import { createExerciseTemplate, getExerciseTemplateById, updateExerciseTemplate, type ExerciseTemplate } from "../services/exerciseDb";
import type { Equipment, ExerciseType, MuscleGroup, ResistanceMode, WeightUnit } from "../types";

interface UseExerciseFormOptions {
    /** Reload the form whenever this turns true (a sheet opening). */
    active: boolean;
    exerciseId?: number;
    initialName?: string;
}

/** State and persistence of the create/edit exercise form. */
export function useExerciseForm({ active, exerciseId, initialName }: UseExerciseFormOptions) {
    const isEditing = exerciseId != null;

    const [name, setName] = useState("");
    const [type, setType] = useState<ExerciseType>("weight");
    const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
    const [equipment, setEquipment] = useState<Equipment | null>(null);
    const [resistanceMode, setResistanceMode] = useState<ResistanceMode>("resistance");
    const [defaultUnit, setDefaultUnit] = useState<WeightUnit>("kg");
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [nameError, setNameError] = useState(false);

    useEffect(() => {
        if (!active) return;

        queueMicrotask(() => {
            if (exerciseId != null) {
                const existing = getExerciseTemplateById(exerciseId);
                if (!existing) return;
                setName(existing.name);
                setType((existing.type as ExerciseType) ?? "weight");
                setMuscleGroup((existing.muscle_group as MuscleGroup) ?? null);
                setEquipment((existing.equipment as Equipment) ?? null);
                setResistanceMode((existing.resistance_mode as ResistanceMode) ?? "resistance");
                setDefaultUnit((existing.default_weight_unit as WeightUnit) ?? "kg");
                setCustomFields(parseCustomFields(existing.custom_fields));
                return;
            }

            setName(initialName?.trim() ?? "");
            setCustomFields([]);
            setNameError(false);
        });
    }, [active, exerciseId, initialName]);

    function reset() {
        setName("");
        setType("weight");
        setMuscleGroup(null);
        setEquipment(null);
        setResistanceMode("resistance");
        setDefaultUnit("kg");
        setCustomFields([]);
        setNameError(false);
    }

    function changeName(value: string) {
        setName(value);
        setNameError(false);
    }

    /** Persists the form. Returns the saved template, or null if it is invalid. */
    function save(): ExerciseTemplate | null {
        const trimmed = name.trim();
        if (!trimmed) {
            setNameError(true);
            return null;
        }
        const values = {
            name: trimmed,
            type,
            muscle_group: muscleGroup,
            equipment,
            resistance_mode: resistanceMode,
            default_weight_unit: defaultUnit,
            custom_fields: type === "other" ? serializeCustomFields(customFields) : null,
        };
        let saved: ExerciseTemplate;
        if (exerciseId != null) {
            updateExerciseTemplate(exerciseId, values);
            saved = getExerciseTemplateById(exerciseId)!;
        } else {
            saved = createExerciseTemplate(values);
        }
        reset();
        return saved;
    }

    return {
        isEditing,
        name, changeName, nameError,
        type, setType,
        muscleGroup, setMuscleGroup,
        equipment, setEquipment,
        resistanceMode, setResistanceMode,
        defaultUnit, setDefaultUnit,
        customFields, setCustomFields,
        reset, save,
    };
}

export type ExerciseForm = ReturnType<typeof useExerciseForm>;
