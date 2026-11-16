// Durations as a clock: "m:ss", or "h:mm:ss" from an hour on.

/** "0:45", "31:00", "1:02:03". */
export function formatDuration(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Typed digits fill the clock from the right, like a kitchen timer:
 * "1" → 0:01, "130" → 1:30, "13000" → 1:30:00. A clock text coming back
 * through here keeps its value. Null when there are more than `maxDigits`.
 */
export function digitsToClockText(text: string, maxDigits = 6): string | null {
    const digits = text.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length > maxDigits) return null;
    if (digits === "") return "";
    const padded = digits.padStart(3, "0");
    const ss = padded.slice(-2);
    if (padded.length <= 4) return `${Number(padded.slice(0, -2))}:${ss}`;
    return `${Number(padded.slice(0, -4))}:${padded.slice(-4, -2)}:${ss}`;
}

/**
 * The seconds a clock text ("m:ss", "h:mm:ss") or bare number of seconds
 * stands for. Lenient: "1:90" is 150 seconds. Null when it is not a duration.
 */
export function parseDuration(text: string): number | null {
    const trimmed = text.trim();
    if (!/^\d+(:\d+){0,2}$/.test(trimmed)) return null;
    return trimmed.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}
