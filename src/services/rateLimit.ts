import i18n from "@/src/i18n";

/** Every limit we honour is published per minute; nothing else has needed a window yet. */
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Thrown when a request would spend more of an API's budget than it allows.
 * Kept apart from a network failure so the UI can say how long the wait is
 * instead of blaming the connection.
 */
export class RateLimitError extends Error {
    /**
     * Checked in place of `instanceof`, which a subclass of a built-in does not
     * reliably survive transpilation.
     */
    readonly rateLimited = true;

    constructor(public readonly waitSeconds: number) {
        super(i18n.t("common.rateLimitedWait", { seconds: waitSeconds }));
        this.name = "RateLimitError";
    }
}

export function isRateLimitError(err: unknown): err is RateLimitError {
    return err instanceof Error && (err as RateLimitError).rateLimited === true;
}

export interface RateLimiter {
    /**
     * Claim one of the requests the window allows, or throw with the wait time.
     * A caller that must not be charged for a request which carried nothing
     * back `release()`s its slot again.
     *
     * @throws {RateLimitError} when the window is full.
     */
    reserve(): { release: () => void };
}

/**
 * A client-side sliding-window request budget, one per endpoint an API
 * publishes a limit for. Request timestamps rather than a counter, so users can
 * burst a few requests quickly (or space them out) as long as the window stays
 * under the cap.
 *
 * This is a courtesy limiter, not an enforcement one: it keeps normal use well
 * inside what the API asks for, since the alternative is the server rate-
 * limiting — or banning — the user's IP.
 */
export function createRateLimiter(
    maxPerWindow: number,
    windowMs: number = DEFAULT_WINDOW_MS,
): RateLimiter {
    const timestamps: number[] = [];
    return {
        reserve() {
            const now = Date.now();
            // Drop timestamps that have aged out of the sliding window.
            while (timestamps.length && now - timestamps[0] >= windowMs) {
                timestamps.shift();
            }
            if (timestamps.length >= maxPerWindow) {
                throw new RateLimitError(Math.ceil((windowMs - (now - timestamps[0])) / 1000));
            }
            timestamps.push(now);
            return {
                release: () => {
                    const i = timestamps.indexOf(now);
                    if (i !== -1) timestamps.splice(i, 1);
                },
            };
        },
    };
}
