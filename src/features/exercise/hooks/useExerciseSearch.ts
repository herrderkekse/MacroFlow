import {
    getExerciseTemplatesByMuscleGroup,
    getRecentExerciseTemplates,
    searchExerciseTemplates,
    type ExerciseTemplate,
} from "@/src/features/exercise/services/exerciseDb";
import type { MuscleGroup } from "@/src/features/exercise/types";
import { useCallback, useEffect, useState } from "react";

export function useExerciseSearch() {
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState<ExerciseTemplate[]>([]);
    const [recentTemplates, setRecentTemplates] = useState<ExerciseTemplate[]>([]);
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | null>(null);
    const [muscleGroupResults, setMuscleGroupResults] = useState<ExerciseTemplate[]>([]);

    const loadRecent = useCallback(() => {
        setRecentTemplates(getRecentExerciseTemplates());
    }, []);

    useEffect(() => {
        loadRecent();
    }, [loadRecent]);

    useEffect(() => {
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(() => {
            setSearchResults(searchExerciseTemplates(query.trim()));
        }, 100);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (!selectedMuscleGroup) {
            setMuscleGroupResults([]);
            return;
        }
        setMuscleGroupResults(getExerciseTemplatesByMuscleGroup(selectedMuscleGroup));
    }, [selectedMuscleGroup]);

    function handleSelectMuscleGroup(group: MuscleGroup) {
        setSelectedMuscleGroup((prev) => (prev === group ? null : group));
    }

    function refresh() {
        loadRecent();
        if (selectedMuscleGroup) {
            setMuscleGroupResults(getExerciseTemplatesByMuscleGroup(selectedMuscleGroup));
        }
    }

    const isSearching = query.trim().length >= 2;

    return {
        query,
        setQuery,
        searchResults,
        recentTemplates,
        selectedMuscleGroup,
        handleSelectMuscleGroup,
        muscleGroupResults,
        isSearching,
        refresh,
    };
}
