const KG_PER_LB = 0.45359237;

function toKg(weight: number, weightUnit: string): number {
    return weightUnit === "lb" ? weight * KG_PER_LB : weight;
}

function toEstimated1RM(weightKg: number, reps: number): number {
    return weightKg * (1 + reps / 30);
}

function isBetterPerformance(candidate: number, currentBest: number | null, resistanceMode: string): boolean {
    if (currentBest === null) return true;
    return resistanceMode === "assistance" ? candidate < currentBest : candidate > currentBest;
}

const oneRepMax = {
    toKg,
    toEstimated1RM,
    isBetterPerformance,
};

export default oneRepMax;
