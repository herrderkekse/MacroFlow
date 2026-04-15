import type { ExerciseSet } from "@/src/features/exercise/services/exerciseDb";

export function formatSetSummary(sets: ExerciseSet[]): string {
    const completed = sets.filter((s) => s.completed_at);
    if (completed.length === 0) return "—";

    const hasWeight = completed.some((s) => s.weight !== null && s.reps !== null);
    if (hasWeight) {
        return formatWeightSets(completed);
    }

    const hasCardio = completed.some((s) => s.duration_seconds !== null);
    if (hasCardio) {
        return formatCardioSets(completed);
    }

    const hasReps = completed.some((s) => s.reps !== null);
    if (hasReps) {
        return formatBodyweightSets(completed);
    }

    return `${completed.length} sets`;
}

function formatWeightSets(sets: ExerciseSet[]): string {
    const groups = new Map<string, number>();
    for (const s of sets) {
        if (s.weight === null || s.reps === null) continue;
        const key = `${s.reps}@${s.weight}${s.weight_unit}`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
    }

    return Array.from(groups.entries())
        .map(([key, count]) => {
            const match = key.match(/^(\d+)@([\d.]+)(.+)$/);
            if (!match) return key;
            return `${count}×${match[1]} @ ${match[2]}${match[3]}`;
        })
        .join(", ");
}

function formatCardioSets(sets: ExerciseSet[]): string {
    const durations = sets
        .filter((s) => s.duration_seconds !== null)
        .map((s) => formatDuration(s.duration_seconds!));
    return durations.join(", ");
}

function formatBodyweightSets(sets: ExerciseSet[]): string {
    const groups = new Map<number, number>();
    for (const s of sets) {
        if (s.reps === null) continue;
        groups.set(s.reps, (groups.get(s.reps) ?? 0) + 1);
    }
    return Array.from(groups.entries())
        .map(([reps, count]) => `${count}×${reps}`)
        .join(", ");
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

export function formatRirRange(sets: ExerciseSet[]): string | null {
    const rirValues = sets
        .filter((s) => s.completed_at && s.rir !== null)
        .map((s) => s.rir!);
    if (rirValues.length === 0) return null;

    const min = Math.min(...rirValues);
    const max = Math.max(...rirValues);
    return min === max ? `RIR ${min}` : `RIR ${min}-${max}`;
}

export function formatElapsedTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
