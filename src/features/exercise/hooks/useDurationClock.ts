import Storage from "expo-sqlite/kv-store";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { clockToFieldValue, type DurationTarget } from "../helpers/durationClock";
import {
    cancelDurationTimerNotification,
    isWorkoutScreenVisible,
    scheduleDurationTimerNotification,
} from "../services/restTimerNotifications";
import { playTimerChimeIfEnabled } from "../services/restTimerSound";

// The stopwatch / timer of a duration exercise (issue #421). One clock for
// the whole app, owned by the exercise it was started on; persisted like the
// rest timer so a run survives the OS killing the app.

export type ClockMode = "stopwatch" | "timer";

/** The shortest and longest countdown the timer accepts (the stepper shows m:ss). */
export const TIMER_MIN_SECONDS = 5;
export const TIMER_MAX_SECONDS = 99 * 60 + 59;

interface ClockState {
    mode: ClockMode;
    /** The exercise the clock is running or paused for; null while idle. */
    workoutExerciseId: number | null;
    /** Running since; null while paused or idle. */
    startedAtEpoch: number | null;
    /** Time counted before the current run (pauses split a run). */
    bankedMs: number;
    /** The timer's countdown, kept as the next one's default. */
    timerSeconds: number;
}

interface ClockStore extends ClockState {
    setMode: (mode: ClockMode) => void;
    setTimerSeconds: (seconds: number) => void;
    /** Starts the clock for an exercise, or resumes it; a clock of another exercise starts over. */
    start: (workoutExerciseId: number) => void;
    pause: () => void;
    reset: () => void;
    /** Stops a timer that has run out. True only for the caller that stopped it. */
    finishTimer: () => boolean;
}

const IDLE = { workoutExerciseId: null, startedAtEpoch: null, bankedMs: 0 } as const;

/** A clock restored after this long is dropped: the workout is long over. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

function elapsedMs(state: Pick<ClockState, "startedAtEpoch" | "bankedMs">, now = Date.now()): number {
    return state.bankedMs + (state.startedAtEpoch != null ? now - state.startedAtEpoch : 0);
}

const useClockStore = create<ClockStore>()(persist((set, get) => ({
    mode: "stopwatch",
    ...IDLE,
    timerSeconds: 60,
    setMode: (mode) => {
        if (get().workoutExerciseId != null) return;
        set({ mode });
    },
    setTimerSeconds: (seconds) => {
        if (get().workoutExerciseId != null) return;
        set({ timerSeconds: Math.min(TIMER_MAX_SECONDS, Math.max(TIMER_MIN_SECONDS, Math.round(seconds))) });
    },
    start: (workoutExerciseId) => {
        const state = get();
        if (state.startedAtEpoch != null && state.workoutExerciseId === workoutExerciseId) return;
        const now = Date.now();
        let bankedMs = state.workoutExerciseId === workoutExerciseId ? state.bankedMs : 0;
        // A timer that has run out starts over.
        if (state.mode === "timer" && bankedMs >= state.timerSeconds * 1000) bankedMs = 0;
        set({ workoutExerciseId, startedAtEpoch: now, bankedMs });
        if (state.mode === "timer") {
            scheduleDurationTimerNotification(now + state.timerSeconds * 1000 - bankedMs);
        } else {
            cancelDurationTimerNotification();
        }
    },
    pause: () => {
        const state = get();
        if (state.startedAtEpoch == null) return;
        set({ startedAtEpoch: null, bankedMs: elapsedMs(state) });
        cancelDurationTimerNotification();
    },
    reset: () => {
        set(IDLE);
        cancelDurationTimerNotification();
    },
    finishTimer: () => {
        const state = get();
        if (state.mode !== "timer" || state.startedAtEpoch == null) return false;
        if (elapsedMs(state) < state.timerSeconds * 1000) return false;
        set({ startedAtEpoch: null, bankedMs: state.timerSeconds * 1000 });
        return true;
    },
}), {
    name: "exercise.durationClock",
    storage: createJSONStorage(() => Storage),
    partialize: ({ mode, workoutExerciseId, startedAtEpoch, bankedMs, timerSeconds }): ClockState =>
        ({ mode, workoutExerciseId, startedAtEpoch, bankedMs, timerSeconds }),
    merge: (persisted, current) => {
        const restored = { ...current, ...(persisted as Partial<ClockState>) };
        if (restored.startedAtEpoch != null && Date.now() - restored.startedAtEpoch > STALE_AFTER_MS) {
            return { ...restored, ...IDLE };
        }
        return restored;
    },
}));

export interface DurationClock {
    mode: ClockMode;
    timerSeconds: number;
    /** Whether the clock belongs to this exercise (running or paused). */
    isOwn: boolean;
    isRunning: boolean;
    /** Seconds counted so far; for a timer, of its countdown. */
    elapsedSeconds: number;
    /** A timer that has counted all the way down. */
    isDone: boolean;
    setMode: (mode: ClockMode) => void;
    setTimerSeconds: (seconds: number) => void;
    start: () => void;
    pause: () => void;
    reset: () => void;
}

/**
 * The clock as one exercise sees it. Ticks only while `live` and the clock
 * runs for this exercise, so idle cards and rows don't re-render every second.
 */
export function useDurationClock(workoutExerciseId: number, live = true): DurationClock {
    const store = useClockStore();
    const isOwn = store.workoutExerciseId === workoutExerciseId;
    const isRunning = isOwn && store.startedAtEpoch != null;
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!isRunning || !live) return;
        const tick = () => setNow(Date.now());
        tick();
        // Faster than once a second, so the reading never lags a whole second behind.
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [isRunning, live, store.startedAtEpoch]);

    // `now` may predate a run just started; the clock never reads below what it banked.
    const elapsed = isOwn ? Math.floor(elapsedMs(store, Math.max(now, store.startedAtEpoch ?? 0)) / 1000) : 0;
    const isTimer = store.mode === "timer";

    return {
        mode: store.mode,
        timerSeconds: store.timerSeconds,
        isOwn,
        isRunning,
        elapsedSeconds: isTimer ? Math.min(elapsed, store.timerSeconds) : elapsed,
        isDone: isOwn && isTimer && elapsed >= store.timerSeconds,
        setMode: store.setMode,
        setTimerSeconds: store.setTimerSeconds,
        start: () => store.start(workoutExerciseId),
        pause: store.pause,
        reset: store.reset,
    };
}

/** The exercise the clock is running or paused for, without ticking. */
export function useClockOwnerId(): number | null {
    return useClockStore((s) => s.workoutExerciseId);
}

/** Ends the clock, e.g. when its workout is finished or discarded. */
export function resetDurationClock() {
    useClockStore.getState().reset();
}

/** A timer that ran out this long ago is stopped quietly: its notification already told the user. */
const LATE_ALARM_MS = 3000;

/**
 * Mounted once by the workout screen: when a timer runs out it stops it, with
 * a haptic and (setting permitting) the chime — whether or not the timer's
 * card or sheet is on screen.
 */
export function useDurationTimerAlarm() {
    const { mode, startedAtEpoch, bankedMs, timerSeconds } = useClockStore();

    useEffect(() => {
        if (mode !== "timer" || startedAtEpoch == null) return;
        const endsAt = startedAtEpoch + timerSeconds * 1000 - bankedMs;
        const ring = () => {
            const late = Date.now() - endsAt > LATE_ALARM_MS;
            if (!useClockStore.getState().finishTimer() || late) return;
            triggerHaptic();
            if (isWorkoutScreenVisible() && AppState.currentState === "active") playTimerChimeIfEnabled();
        };
        const timeout = setTimeout(ring, Math.max(0, endsAt - Date.now()));
        return () => clearTimeout(timeout);
    }, [mode, startedAtEpoch, bankedMs, timerSeconds]);
}

async function triggerHaptic() {
    try {
        const Haptics = await import("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
        // Haptics not available (e.g. web)
    }
}

/**
 * What a set row takes from the clock: the value to fill into the duration
 * target while the clock is going for this exercise — the stopwatch's reading,
 * or the timer's countdown — or null.
 */
export function useClockFill(target: DurationTarget | null, workoutExerciseId: number, isActiveSet: boolean) {
    const enabled = !!target && isActiveSet;
    const clock = useDurationClock(workoutExerciseId, enabled);
    const value = enabled && clock.isOwn
        ? clockToFieldValue(clock.mode === "timer" ? clock.timerSeconds : clock.elapsedSeconds, target)
        : null;
    return { value, isOwn: enabled && clock.isOwn, reset: clock.reset };
}
