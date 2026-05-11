import { create } from "zustand";
import { useCallback, useEffect, useRef, useState } from "react";

const REST_DEFAULTS: Record<string, number> = {
    warmup: 60,
    working: 120,
    dropset: 30,
    failure: 120,
};

interface TimerState {
    isRunning: boolean;
    startedAtEpoch: number;
    targetDurationSeconds: number;
    workoutExerciseId: number | null;
    lastUsedDuration: number | null;
}

interface TimerStore extends TimerState {
    start: (workoutExerciseId: number, setType: string) => void;
    stop: () => void;
    setDuration: (seconds: number) => void;
}

const useTimerStore = create<TimerStore>((set) => ({
    isRunning: false,
    startedAtEpoch: 0,
    targetDurationSeconds: 120,
    workoutExerciseId: null,
    lastUsedDuration: null,
    start: (workoutExerciseId, setType) =>
        set((state) => ({
            isRunning: true,
            startedAtEpoch: Date.now(),
            targetDurationSeconds: state.lastUsedDuration ?? REST_DEFAULTS[setType] ?? 120,
            workoutExerciseId,
        })),
    stop: () =>
        set({ isRunning: false, startedAtEpoch: 0, workoutExerciseId: null }),
    setDuration: (seconds) => {
        const clamped = Math.max(15, seconds);
        set({ targetDurationSeconds: clamped, lastUsedDuration: clamped });
    },
}));

export interface UseRestTimerReturn {
    isRunning: boolean;
    elapsedSeconds: number;
    targetSeconds: number;
    workoutExerciseId: number | null;
    start: (workoutExerciseId: number, setType: string) => void;
    skip: () => void;
    setDuration: (seconds: number) => void;
    isTargetReached: boolean;
}

export function useRestTimer(): UseRestTimerReturn {
    const store = useTimerStore();
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hapticFiredRef = useRef(false);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        if (store.isRunning && store.startedAtEpoch > 0) {
            const tick = () => {
                const elapsed = Math.floor((Date.now() - store.startedAtEpoch) / 1000);
                setElapsedSeconds(elapsed);

                // Haptic feedback when target reached (fire once)
                if (elapsed >= store.targetDurationSeconds && !hapticFiredRef.current) {
                    hapticFiredRef.current = true;
                    triggerHaptic();
                }
            };
            tick();
            intervalRef.current = setInterval(tick, 1000);
        } else {
            setElapsedSeconds(0);
            hapticFiredRef.current = false;
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [store.isRunning, store.startedAtEpoch, store.targetDurationSeconds]);

    const skip = useCallback(() => {
        store.stop();
    }, [store]);

    return {
        isRunning: store.isRunning,
        elapsedSeconds,
        targetSeconds: store.targetDurationSeconds,
        workoutExerciseId: store.workoutExerciseId,
        start: store.start,
        skip,
        setDuration: store.setDuration,
        isTargetReached: elapsedSeconds >= store.targetDurationSeconds,
    };
}

async function triggerHaptic() {
    try {
        const Haptics = await import("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
        // Haptics not available (e.g. web)
    }
}
