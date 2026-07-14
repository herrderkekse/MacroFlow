import { expoDb } from "@/src/services/db";
import * as SecureStore from "expo-secure-store";
import type { SyncCredentials } from "./syncClient";

// Non-secret settings and sync bookkeeping live in the sync_meta table
// (which is itself never synced). The password is a secret and therefore
// lives in SecureStore, like the AI API keys.
const URL_KEY = "sync_url";
const USERNAME_KEY = "sync_username";
const PASSWORD_SECURE_KEY = "sync_password";
const CURSOR_KEY = "sync_cursor";
const DEVICE_ID_KEY = "sync_device_id";
const INITIAL_ENQUEUE_KEY = "sync_initial_enqueue";
const LAST_SYNC_AT_KEY = "sync_last_sync_at";
const LAST_ERROR_KEY = "sync_last_error";

export interface SyncStatus {
    configured: boolean;
    lastSyncAt: number | null;
    lastError: string | null;
    pendingCount: number;
}

// ── sync_meta key-value access ─────────────────────────────

export function getSyncMeta(key: string): string | null {
    const row = expoDb.getFirstSync<{ value: string | null }>(
        `SELECT value FROM sync_meta WHERE key = ?`,
        [key],
    );
    return row?.value ?? null;
}

export function setSyncMeta(key: string, value: string) {
    expoDb.runSync(
        `INSERT INTO sync_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
    );
}

// ── Settings ───────────────────────────────────────────────

/** Returns the saved credentials, or null when sync is not (fully) configured. */
export async function loadSyncSettings(): Promise<SyncCredentials | null> {
    const url = getSyncMeta(URL_KEY);
    const username = getSyncMeta(USERNAME_KEY);
    if (!url || !username) return null;
    const password = await SecureStore.getItemAsync(PASSWORD_SECURE_KEY);
    if (!password) return null;
    return { url, username, password };
}

/** Clears the saved account so the app stops syncing (a "sign out"). Local data
 * is untouched; the cursor is reset so a later sign-in re-syncs cleanly. */
export async function clearSyncSettings(): Promise<void> {
    setSyncMeta(URL_KEY, "");
    setSyncMeta(USERNAME_KEY, "");
    setSyncMeta(CURSOR_KEY, "0");
    setSyncMeta(INITIAL_ENQUEUE_KEY, "0");
    await SecureStore.deleteItemAsync(PASSWORD_SECURE_KEY);
}

export async function saveSyncSettings(settings: SyncCredentials): Promise<void> {
    const url = settings.url.trim().replace(/\/+$/, "");
    const previousUrl = getSyncMeta(URL_KEY);
    if (previousUrl !== null && previousUrl !== url) {
        // Pointing at a different server: its change log and cursors are
        // unrelated, so start over and re-upload everything on the next sync.
        setSyncMeta(CURSOR_KEY, "0");
        setSyncMeta(INITIAL_ENQUEUE_KEY, "0");
    }
    setSyncMeta(URL_KEY, url);
    setSyncMeta(USERNAME_KEY, settings.username.trim());
    await SecureStore.setItemAsync(PASSWORD_SECURE_KEY, settings.password);
}

// ── Bookkeeping used by the sync engine ────────────────────

export function getSyncCursor(): string {
    return getSyncMeta(CURSOR_KEY) ?? "0";
}

export function isInitialEnqueueDone(): boolean {
    return getSyncMeta(INITIAL_ENQUEUE_KEY) === "1";
}

export function markInitialEnqueueDone() {
    setSyncMeta(INITIAL_ENQUEUE_KEY, "1");
}

/** Stable random id identifying this install, for echo suppression. */
export function getDeviceId(): string {
    let id = getSyncMeta(DEVICE_ID_KEY);
    if (!id) {
        id = randomHex(16);
        setSyncMeta(DEVICE_ID_KEY, id);
    }
    return id;
}

export function recordSyncSuccess() {
    setSyncMeta(LAST_SYNC_AT_KEY, String(Date.now()));
    setSyncMeta(LAST_ERROR_KEY, "");
}

export function recordSyncError(message: string) {
    setSyncMeta(LAST_ERROR_KEY, message);
}

export function getSyncStatus(): Omit<SyncStatus, "configured"> {
    const lastSyncAtRaw = getSyncMeta(LAST_SYNC_AT_KEY);
    const lastError = getSyncMeta(LAST_ERROR_KEY);
    const pending = expoDb.getFirstSync<{ count: number }>(
        `SELECT COUNT(DISTINCT table_name || '/' || row_uuid) AS count FROM sync_queue`,
    );
    return {
        lastSyncAt: lastSyncAtRaw ? Number(lastSyncAtRaw) : null,
        lastError: lastError || null,
        pendingCount: pending?.count ?? 0,
    };
}

function randomHex(bytes: number): string {
    let out = "";
    for (let i = 0; i < bytes * 2; i++) {
        out += Math.floor(Math.random() * 16).toString(16);
    }
    return out;
}
