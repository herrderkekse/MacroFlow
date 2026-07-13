import { create } from "zustand";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
    cancelRestTimerNotification,
    scheduleRestTimerNotification,
    setWorkoutScreenVisible,
} from "../services/restTimerNotifications";
import { playTimerChimeIfEnabled } from "../services/restTimerSound";

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

const useTimerStore = create<TimerStore>((set, get) => ({
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
        const clamped = Math.max(15, seconds);
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
