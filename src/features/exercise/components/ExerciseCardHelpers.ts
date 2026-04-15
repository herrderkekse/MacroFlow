import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { StyleSheet } from "react-native";
import type { ExerciseSet } from "../services/exerciseDb";

export interface Prefill {
    weight: number | null;
    reps: number | null;
    rir: number | null;
    duration: number | null;
    distance: number | null;
}

/** Determine if a set is the "active" (first non-completed) set. */
export function isActiveSet(set: ExerciseSet, index: number, sets: ExerciseSet[]): boolean {
    if (!!set.completed_at) return false;
    const firstUncompletedIdx = sets.findIndex((s) => !s.completed_at);
    return firstUncompletedIdx === index;
}

/** Pre-fill logic: previous completed set in this exercise > last workout's matching set. */
export function getPrefillForSet(index: number, sets: ExerciseSet[], lastWorkoutSets: ExerciseSet[]): Prefill {
    // 1. Previous completed set in same exercise
    for (let i = index - 1; i >= 0; i--) {
        if (sets[i].completed_at) {
            return {
                weight: sets[i].weight, reps: sets[i].reps, rir: sets[i].rir,
                duration: sets[i].duration_seconds, distance: sets[i].distance_meters,
            };
        }
    }
    // 2. Matching set from last workout
    if (lastWorkoutSets.length > index) {
        const lw = lastWorkoutSets[index];
        return { weight: lw.weight, reps: lw.reps, rir: lw.rir, duration: lw.duration_seconds, distance: lw.distance_meters };
    }
    if (lastWorkoutSets.length > 0) {
        const lw = lastWorkoutSets[lastWorkoutSets.length - 1];
        return { weight: lw.weight, reps: lw.reps, rir: lw.rir, duration: lw.duration_seconds, distance: lw.distance_meters };
    }
    return { weight: null, reps: null, rir: null, duration: null, distance: null };
}

/** Build a compact summary string for a set list, e.g. "80kg × 8" for the best completed set. */
export function bestSetSummary(sets: ExerciseSet[]): string {
    const completed = sets.filter((s) => !!s.completed_at);
    if (completed.length === 0) return "";
    // Pick the set with the highest weight (or most reps for bodyweight)
    const best = completed.reduce((a, b) => {
        const aScore = (a.weight ?? 0) * 1000 + (a.reps ?? 0);
        const bScore = (b.weight ?? 0) * 1000 + (b.reps ?? 0);
        return bScore > aScore ? b : a;
    });
    if (best.weight != null && best.reps != null) {
        return `${best.weight}${best.weight_unit ?? "kg"} × ${best.reps}`;
    }
    if (best.reps != null) return `× ${best.reps}`;
    if (best.duration_seconds != null) return `${best.duration_seconds}s`;
    return "";
}

// ── Expanded card styles ────────────────────────────────────────────────────

export function createExerciseCardStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
            borderWidth: 2,
            borderColor: colors.primary,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        orderNum: {
            fontSize: fontSize.md,
            fontWeight: "800",
            color: colors.primary,
        },
        exerciseName: {
            flex: 1,
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
        },
        noteText: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            fontStyle: "italic",
            marginBottom: spacing.sm,
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingBottom: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: spacing.xs,
        },
        headerCell: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
        },
        setCol: { width: 32 },
        valueCol: { flex: 1, textAlign: "center" as const },
        rirCol: { width: 36, textAlign: "center" as const },
        checkCol: { width: 28, alignItems: "center" as const },
        emptyText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            textAlign: "center",
            paddingVertical: spacing.md,
        },
        addSetBtn: {
            paddingVertical: spacing.sm,
            alignItems: "center",
        },
        addSetText: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.primary,
        },
    });
}

// ── Collapsed card styles ───────────────────────────────────────────────────

export function createCollapsedCardStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        orderNum: {
            fontSize: fontSize.sm,
            fontWeight: "700",
            color: colors.textTertiary,
            width: 22,
        },
        name: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.text,
        },
        progressBadge: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.primaryLight,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: borderRadius.sm,
        },
        progressBadgeComplete: {
            backgroundColor: colors.success + "22",
        },
        progressText: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.primary,
        },
        progressTextComplete: {
            color: colors.success,
        },
        bestSetText: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            fontWeight: "500",
        },
        chevron: {
            marginLeft: 2,
        },
    });
}
