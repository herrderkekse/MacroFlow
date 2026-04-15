import {
    getEstimated1RMSeries,
    getExerciseHistory,
    getExercisePersonalBest,
    type Estimated1RMPoint,
    type ExercisePersonalBest,
    type WorkoutExerciseWithSets,
} from "@/src/features/exercise/services/exerciseDb";
import { useCallback, useEffect, useState } from "react";

interface UseExerciseHistoryReturn {
    history: WorkoutExerciseWithSets[];
    e1rmSeries: Estimated1RMPoint[];
    personalBest: ExercisePersonalBest | null;
    isLoading: boolean;
    refresh: () => void;
}

export function useExerciseHistory(templateId: number | undefined): UseExerciseHistoryReturn {
    const [history, setHistory] = useState<WorkoutExerciseWithSets[]>([]);
    const [e1rmSeries, setE1rmSeries] = useState<Estimated1RMPoint[]>([]);
    const [personalBest, setPersonalBest] = useState<ExercisePersonalBest | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(() => {
        if (!templateId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            setHistory(getExerciseHistory(templateId, 50));
            setE1rmSeries(getEstimated1RMSeries(templateId));
            setPersonalBest(getExercisePersonalBest(templateId));
        } finally {
            setIsLoading(false);
        }
    }, [templateId]);

    useEffect(() => {
        load();
    }, [load]);

    return { history, e1rmSeries, personalBest, isLoading, refresh: load };
}
