import { useState } from "react";
import { durationTargetOfExercise } from "../helpers/durationClock";
import type { WorkoutExerciseWithSets } from "../services/exerciseDb";
import { useClockOwnerId } from "./useDurationClock";

/** The pages of the workout's pinned card, in swipe order. */
export type StatusPage = "sets" | "rest" | "clock";

interface UseStatusPageOptions {
    exercises: WorkoutExerciseWithSets[];
    expandedId: number | null;
    isLive: boolean;
    restStartedAt: number;
    restRunning: boolean;
    restOver: boolean;
}

/**
 * Which page the workout's pinned card shows, and which exercise its timing
 * page is for. The user swipes between the pages; the card also follows the
 * workout on its own, so a timed exercise goes rest → timing → rest → … :
 *
 * - a rest that starts shows the rest page;
 * - a rest that runs out, or is skipped, shows the timing page when the
 *   exercise being worked on is timed (the sets page otherwise).
 */
export function useStatusPage({ exercises, expandedId, isLive, restStartedAt, restRunning, restOver }: UseStatusPageOptions) {
    // The timing page is for the exercise the clock is going for, or else the open one if it is timed.
    const ownerId = useClockOwnerId();
    const owner = exercises.find((e) => e.workoutExercise.id === ownerId);
    const expanded = exercises.find((e) => e.workoutExercise.id === expandedId);
    const clockExercise = !isLive ? undefined : owner ?? (expanded && durationTargetOfExercise(expanded) ? expanded : undefined);
    const hasClock = !!clockExercise;

    const [page, setPage] = useState<StatusPage>(() => (ownerId != null ? "clock" : restRunning ? "rest" : "sets"));
    const [seen, setSeen] = useState({ restStartedAt, restRunning, restOver });

    if (seen.restStartedAt !== restStartedAt || seen.restRunning !== restRunning || seen.restOver !== restOver) {
        setSeen({ restStartedAt, restRunning, restOver });
        const afterRest: StatusPage = hasClock ? "clock" : "sets";
        if (restRunning && restStartedAt !== seen.restStartedAt) setPage("rest");
        else if (!restRunning && seen.restRunning) setPage(afterRest);
        else if (restRunning && restOver && !seen.restOver && hasClock) setPage("clock");
    }

    const pages: StatusPage[] = hasClock ? ["sets", "rest", "clock"] : ["sets", "rest"];
    return {
        page: pages.includes(page) ? page : "sets",
        pages,
        setPage,
        clockExercise: clockExercise ?? null,
    };
}
