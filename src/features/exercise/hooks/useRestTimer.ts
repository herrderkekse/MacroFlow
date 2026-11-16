import { useIsFocused } from "expo-router";
import Storage from "expo-sqlite/kv-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
    cancelRestTimerNotification,
    scheduleRestTimerNotification,
    setWorkoutScreenVisible,
} from "../services/restTimerNotifications";
import { playTimerChimeIfEnabled } from "../services/restTimerSound";

/** The shortest and longest rest the timer accepts. */
export const REST_MIN_SECONDS = 15;
export const REST_MAX_SECONDS = 60 * 60;

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
    start: (workoutExerciseId: number | null, setType: string) => void;
    stop: () => void;
    setDuration: (seconds: number) => void;
}

const TIMER_STORAGE_KEY = "exercise.restTimer";

/**
 * A timer restored after this long past its target is dropped rather than
 * resumed: the rest (and most likely the workout) is long over.
 */
const STALE_AFTER_TARGET_MS = REST_MAX_SECONDS * 1000;

// Persisted so a running rest survives the OS killing the app mid-workout
// (issue #419). The "rest over" notification is scheduled with the OS and
// outlives the process on its own; only the in-app countdown needs restoring.
const useTimerStore = create<TimerStore>()(persist((set, get) => ({
    isRunning: false,
    startedAtEpoch: 0,
    targetDurationSeconds: 120,
    workoutExerciseId: null,
    lastUsedDuration: null,
    start: (workoutExerciseId, setType) => {
        const targetDurationSeconds = get().lastUsedDuration ?? REST_DEFAULTS[setType] ?? 120;
        const startedAtEpoch = Date.now();
        set({ isRunning: true, startedAtEpoch, targetDurationSeconds, workoutExerciseId });
        // Fires when the timer finishes outside the workout screen (same id → replaces any previous one)
        scheduleRestTimerNotification(startedAtEpoch + targetDurationSeconds * 1000);
    },
    stop: () => {
        set({ isRunning: false, startedAtEpoch: 0, workoutExerciseId: null });
        cancelRestTimerNotification();
    },
    setDuration: (seconds) => {
        const clamped = Math.min(REST_MAX_SECONDS, Math.max(REST_MIN_SECONDS, Math.round(seconds)));
        const { isRunning, startedAtEpoch } = get();
        set({ targetDurationSeconds: clamped, lastUsedDuration: clamped });
        if (isRunning && startedAtEpoch > 0) {
            const fireAtEpoch = startedAtEpoch + clamped * 1000;
            if (fireAtEpoch > Date.now()) {
                scheduleRestTimerNotification(fireAtEpoch);
            } else {
                // New target already passed → the pending notification is stale
                cancelRestTimerNotification();
            }
        }
    },
}), {
    name: TIMER_STORAGE_KEY,
    storage: createJSONStorage(() => Storage),
    partialize: ({ isRunning, startedAtEpoch, targetDurationSeconds, workoutExerciseId, lastUsedDuration }): TimerState =>
        ({ isRunning, startedAtEpoch, targetDurationSeconds, workoutExerciseId, lastUsedDuration }),
    merge: (persisted, current) => {
        const restored = { ...current, ...(persisted as Partial<TimerState>) };
        const overdueMs = Date.now() - (restored.startedAtEpoch + restored.targetDurationSeconds * 1000);
        if (restored.isRunning && overdueMs > STALE_AFTER_TARGET_MS) {
            return { ...restored, isRunning: false, startedAtEpoch: 0, workoutExerciseId: null };
        }
        return restored;
    },
}));

export interface UseRestTimerReturn {
    isRunning: boolean;
    /** When the running rest began; a new rest (even one replacing a running one) changes it. */
    startedAtEpoch: number;
    elapsedSeconds: number;
    targetSeconds: number;
    /** What a rest started now would count down from (a working set's rest). */
    nextTargetSeconds: number;
    workoutExerciseId: number | null;
    start: (workoutExerciseId: number | null, setType: string) => void;
    skip: () => void;
    setDuration: (seconds: number) => void;
    isTargetReached: boolean;
}

export function useRestTimer(): UseRestTimerReturn {
    const store = useTimerStore();
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hapticFiredRef = useRef(false);
    const isFocused = useIsFocused();
    const isFocusedRef = useRef(isFocused);

    // Let the notification handler know whether the workout screen is visible,
    // so it can suppress the rest-timer notification while the user watches the timer.
    useEffect(() => {
        isFocusedRef.current = isFocused;
        setWorkoutScreenVisible(isFocused);
        return () => setWorkoutScreenVisible(false);
    }, [isFocused]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        if (store.isRunning && store.startedAtEpoch > 0) {
            // Re-arm the completion feedback whenever the timer parameters change
            // (a new set's timer `start()`s while the previous one is still running).
            // If the (new) target is already in the past, stay silent — matching the
            // cancelled notification in that case.
            hapticFiredRef.current =
                Math.floor((Date.now() - store.startedAtEpoch) / 1000) >= store.targetDurationSeconds;
            const tick = () => {
                const elapsed = Math.floor((Date.now() - store.startedAtEpoch) / 1000);
                setElapsedSeconds(elapsed);

                // Haptic + chime when target reached (fire once)
                if (elapsed >= store.targetDurationSeconds && !hapticFiredRef.current) {
                    hapticFiredRef.current = true;
                    triggerHaptic();
                    // Only chime while the workout screen is actually visible;
                    // in every other case the scheduled notification carries the sound.
                    if (isFocusedRef.current && AppState.currentState === "active") {
                        playTimerChimeIfEnabled();
                    }
                }
            };
            tick();
            intervalRef.current = setInterval(tick, 1000);
        } else {
            queueMicrotask(() => setElapsedSeconds(0));
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
        startedAtEpoch: store.startedAtEpoch,
        elapsedSeconds,
        targetSeconds: store.targetDurationSeconds,
        nextTargetSeconds: store.lastUsedDuration ?? REST_DEFAULTS.working,
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
