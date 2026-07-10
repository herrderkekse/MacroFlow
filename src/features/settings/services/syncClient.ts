// HTTP transport for the sync protocol. The endpoint contract is documented
// in SYNC.md — keep the two in lockstep.

export interface SyncCredentials {
    url: string;
    username: string;
    password: string;
}

/** One change to one row, as it travels over the wire. */
export interface SyncChange {
    table: string;
    /** The row's cross-device uuid. */
    rowId: string;
    op: "upsert" | "delete";
    /** Client wall-clock ms timestamp of the change, used for last-write-wins. */
    updatedAt: number;
    /** Column values (FK columns hold the referenced row's uuid). Absent for deletes. */
    data?: Record<string, unknown>;
}

/** A change as returned by the server's pull endpoint. */
export interface RemoteChange extends SyncChange {
    /** Server-assigned, strictly increasing sequence number. */
    seq: number;
    /** Device that produced the change (for echo suppression). */
    deviceId: string;
}

export interface PullResult {
    changes: RemoteChange[];
    nextCursor: string;
    hasMore: boolean;
}

const REQUEST_TIMEOUT_MS = 30_000;

export async function testConnection(creds: SyncCredentials): Promise<void> {
    await request(creds, "/api/v1/sync/ping");
}

export async function pullChanges(
    creds: SyncCredentials,
    after: string,
    limit: number,
): Promise<PullResult> {
    const body = await request(
        creds,
        `/api/v1/sync/changes?after=${encodeURIComponent(after)}&limit=${limit}`,
    );
    if (!body || !Array.isArray(body.changes)) {
        throw new Error("Sync server returned an invalid pull response.");
    }
    return {
        changes: body.changes as RemoteChange[],
        nextCursor: String(body.nextCursor ?? after),
        hasMore: body.hasMore === true,
    };
}

export async function pushChanges(
    creds: SyncCredentials,
    deviceId: string,
    changes: SyncChange[],
): Promise<void> {
    await request(creds, "/api/v1/sync/changes", {
        method: "POST",
        body: JSON.stringify({ deviceId, changes }),
    });
}

// ── Plumbing ───────────────────────────────────────────────

async function request(
    creds: SyncCredentials,
    path: string,
    init?: { method?: string; body?: string },
): Promise<any> {
    const base = creds.url.trim().replace(/\/+$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(`${base}${path}`, {
            method: init?.method ?? "GET",
            body: init?.body,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64Encode(`${creds.username}:${creds.password}`)}`,
            },
            signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) {
            throw new Error("Sync server rejected the credentials.");
        }
        if (!res.ok) {
            throw new Error(`Sync server error (HTTP ${res.status}).`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } finally {
        clearTimeout(timeout);
    }
}

// Hermes does not reliably provide btoa, so encode Basic-auth ourselves.
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Encode(input: string): string {
    const bytes = utf8Bytes(input);
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        out += B64_CHARS[b0 >> 2];
        out += B64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
        out += i + 1 < bytes.length ? B64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
        out += i + 2 < bytes.length ? B64_CHARS[b2 & 0x3f] : "=";
    }
    return out;
}

function utf8Bytes(input: string): number[] {
    const bytes: number[] = [];
    for (const ch of input) {
        const code = ch.codePointAt(0)!;
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code < 0x10000) {
            bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        } else {
            bytes.push(
                0xf0 | (code >> 18),
                0x80 | ((code >> 12) & 0x3f),
                0x80 | ((code >> 6) & 0x3f),
                0x80 | (code & 0x3f),
            );
        }
    }
    return bytes;
}
