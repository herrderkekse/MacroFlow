const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeCalendarDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(12, 0, 0, 0);
    return normalized;
}

export function formatDateKey(date: Date): string {
    const normalized = normalizeCalendarDate(date);
    const y = normalized.getFullYear();
    const m = String(normalized.getMonth() + 1).padStart(2, "0");
    const d = String(normalized.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function shiftCalendarDate(date: Date, deltaDays: number): Date {
    const shifted = normalizeCalendarDate(date);
    shifted.setDate(shifted.getDate() + deltaDays);
    return shifted;
}

export function diffCalendarDays(later: Date, earlier: Date): number {
    return Math.round(
        (normalizeCalendarDate(later).getTime() - normalizeCalendarDate(earlier).getTime())
        / MS_PER_DAY,
    );
}

export function diffDateKeys(laterDateKey: string, earlierDateKey: string): number {
    return diffCalendarDays(parseDateKey(laterDateKey), parseDateKey(earlierDateKey));
}