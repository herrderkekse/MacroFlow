import type { UnitSystem } from "@/src/utils/units";

const CM_PER_INCH = 2.54;

/** "62 cm", or "24.4 in" in imperial units. */
export function formatDistance(metres: number, system: UnitSystem): string {
    const cm = metres * 100;
    if (system === "imperial") return `${(cm / CM_PER_INCH).toFixed(1)} in`;
    return `${Math.round(cm)} cm`;
}

/** "0.72 m/s": bar speed is given in metres per second everywhere, as in velocity-based training. */
export function formatVelocity(metresPerSecond: number): string {
    return `${metresPerSecond.toFixed(2)} m/s`;
}

/** "1.1 s" */
export function formatSeconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)} s`;
}
