import type { TFunction } from "i18next";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function formatAgo(t: TFunction, timestamp: number, now = Date.now()): string {
    const elapsed = Math.max(0, now - timestamp);
    if (elapsed < MINUTE) return t("more.card.justNow");
    if (elapsed < HOUR) return t("more.card.minutesAgo", { count: Math.floor(elapsed / MINUTE) });
    if (elapsed < DAY) return t("more.card.hoursAgo", { count: Math.floor(elapsed / HOUR) });
    return t("more.card.daysAgo", { count: Math.floor(elapsed / DAY) });
}
