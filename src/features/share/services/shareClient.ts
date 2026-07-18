// HTTP transport for the share feature. Creating a share reuses the sync
// account's Basic auth; fetching one back is unauthenticated, since the
// recipient may have no account on the sharing server. The endpoint contract
// lives in the MacroFlow-Backend README.

import { base64Encode, type SyncCredentials } from "@/src/features/settings/services/syncClient";

export type ShareKind = "food" | "recipe" | "log";

/** Bump together with the backend's accepted version when the shape changes. */
export const SHARE_PAYLOAD_VERSION = 1;

export interface ShareCreateResult {
    token: string;
    /** Human-facing https link (redirects into the app); what the QR encodes. */
    url: string;
}

export interface FetchedShare {
    kind: ShareKind;
    version: number;
    payload: unknown;
    createdAt: number;
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Uploads a payload to the sync server and returns its share token + URL. */
export async function createShare(
    creds: SyncCredentials,
    kind: ShareKind,
    payload: object,
): Promise<ShareCreateResult> {
    const body = await request(`${trimBase(creds.url)}/api/v1/share`, {
        method: "POST",
        body: JSON.stringify({ kind, version: SHARE_PAYLOAD_VERSION, payload }),
        authorization: `Basic ${base64Encode(`${creds.username}:${creds.password}`)}`,
    });
    if (!body?.token || !body?.url) {
        throw new Error("Share server returned an invalid response.");
    }
    return { token: String(body.token), url: String(body.url) };
}

/** Fetches a shared payload back from the server it was created on. */
export async function fetchShare(baseUrl: string, token: string): Promise<FetchedShare> {
    const body = await request(
        `${trimBase(baseUrl)}/api/v1/share/${encodeURIComponent(token)}`,
    );
    if (!body?.kind || typeof body.payload !== "object" || body.payload === null) {
        throw new Error("Share server returned an invalid response.");
    }
    return {
        kind: body.kind as ShareKind,
        version: Number(body.version ?? 0),
        payload: body.payload,
        createdAt: Number(body.createdAt ?? 0),
    };
}

// ── Plumbing ───────────────────────────────────────────────

function trimBase(url: string): string {
    return url.trim().replace(/\/+$/, "");
}

async function request(
    url: string,
    init?: { method?: string; body?: string; authorization?: string },
): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetch(url, {
            method: init?.method ?? "GET",
            body: init?.body,
            headers: {
                "Content-Type": "application/json",
                ...(init?.authorization ? { Authorization: init.authorization } : {}),
            },
            signal: controller.signal,
        });
    } catch {
        throw new Error("Could not reach the share server. Check your connection.");
    } finally {
        clearTimeout(timeout);
    }

    if (res.status === 401 || res.status === 403) {
        throw new Error("The share server rejected the sync account's credentials.");
    }
    if (res.status === 404) {
        throw new Error("This share does not exist or has expired.");
    }
    if (res.status === 413) {
        throw new Error("This item is too large to share.");
    }
    if (res.status === 429) {
        throw new Error("Too many share requests — please try again later.");
    }
    if (!res.ok) {
        throw new Error(`Share server error (HTTP ${res.status}).`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}
