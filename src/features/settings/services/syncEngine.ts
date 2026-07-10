import { expoDb } from "@/src/services/db";
import { SYNC_TABLES, singletonUuid, type SyncTableDef } from "@/src/services/db/syncTables";
import {
    pullChanges,
    pushChanges,
    type RemoteChange,
    type SyncChange,
    type SyncCredentials,
} from "./syncClient";
import {
    getDeviceId,
    getSyncCursor,
    isInitialEnqueueDone,
    loadSyncSettings,
    markInitialEnqueueDone,
    recordSyncError,
    recordSyncSuccess,
    setSyncMeta,
} from "./syncSettings";

// Delta sync with per-row last-write-wins conflict resolution. Local changes
// are captured by SQLite triggers into sync_queue (see initDB) and pushed as
// upserts/deletes keyed by row uuid; remote changes are pulled from an
// append-only server log and applied behind the trigger-suppression flag.
// Full concept and server contract: SYNC.md.

const PULL_LIMIT = 500;
const PUSH_BATCH_SIZE = 200;
const MAX_PULL_PAGES = 50;

export interface SyncResult {
    pushed: number;
    pulled: number;
}

interface PendingEntry {
    tableName: string;
    rowUuid: string;
    op: "upsert" | "delete";
    updatedAt: number;
}

let inFlight: Promise<SyncResult> | null = null;

/** Run a full sync cycle. Concurrent calls share the in-flight run. */
export function syncNow(): Promise<SyncResult> {
    if (!inFlight) {
        inFlight = doSync().finally(() => {
            inFlight = null;
        });
    }
    return inFlight;
}

/** Best-effort sync for app start/foreground: silent no-op when sync is not
 *  configured or the server is unreachable (changes stay queued). */
export async function syncIfConfigured(): Promise<void> {
    try {
        if (!(await loadSyncSettings())) return;
        await syncNow();
    } catch {
        // Offline or server down — sync_queue keeps the changes for later.
    }
}

async function doSync(): Promise<SyncResult> {
    const settings = await loadSyncSettings();
    if (!settings) throw new Error("Sync is not configured.");
    const deviceId = getDeviceId();
    try {
        ensureInitialEnqueue();
        let pulled = await pullAll(settings, deviceId);
        const pushed = await pushAll(settings, deviceId);
        // Advance the cursor past our own echoes so the next sync is cheap.
        if (pushed > 0) pulled += await pullAll(settings, deviceId);
        recordSyncSuccess();
        return { pushed, pulled };
    } catch (e: any) {
        recordSyncError(e?.message ?? "Unknown sync error");
        throw e;
    }
}

// ── Initial enqueue ────────────────────────────────────────
// Data created before sync was enabled has no queue entries. On the first
// sync (and after switching servers) enqueue every row with updatedAt = 0 so
// it uploads, but loses against any existing server version of the same row.

function ensureInitialEnqueue() {
    if (isInitialEnqueueDone()) return;
    expoDb.withTransactionSync(() => {
        for (const t of SYNC_TABLES) {
            expoDb.runSync(
                `INSERT INTO sync_queue (table_name, row_uuid, op, updated_at)
                 SELECT '${t.name}', uuid, 'upsert', 0 FROM ${t.name} WHERE uuid IS NOT NULL`,
            );
        }
        markInitialEnqueueDone();
    });
}

// ── Pull ───────────────────────────────────────────────────

async function pullAll(settings: SyncCredentials, deviceId: string): Promise<number> {
    let applied = 0;
    for (let page = 0; page < MAX_PULL_PAGES; page++) {
        const result = await pullChanges(settings, getSyncCursor(), PULL_LIMIT);
        applied += applyRemoteChanges(result.changes, deviceId, result.nextCursor);
        if (!result.hasMore) break;
    }
    return applied;
}

/** Apply one pulled batch and advance the cursor, atomically. */
function applyRemoteChanges(changes: RemoteChange[], myDeviceId: string, nextCursor: string): number {
    let applied = 0;
    expoDb.withTransactionSync(() => {
        setSyncMeta("sync_applying", "1");
        try {
            for (const change of orderForApply(changes)) {
                if (change.deviceId === myDeviceId) {
                    // Our own echo: just remember its version timestamp.
                    bumpRowVersion(change.table, change.rowId, change.updatedAt);
                    continue;
                }
                try {
                    if (applyChange(change, myDeviceId)) applied++;
                } catch (e) {
                    // A malformed/incompatible change must not block the rest.
                    console.warn(`Sync: failed to apply ${change.op} on ${change.table}/${change.rowId}`, e);
                }
            }
            setSyncMeta("sync_cursor", nextCursor);
        } finally {
            setSyncMeta("sync_applying", "0");
        }
    });
    return applied;
}

/** Upserts parents-before-children, then deletes children-before-parents. */
function orderForApply(changes: RemoteChange[]): RemoteChange[] {
    const known = changes.filter((c) => tableDef(c.table));
    const upserts = known
        .filter((c) => c.op === "upsert")
        .sort((a, b) => tableRank(a.table) - tableRank(b.table) || selfRefRank(a) - selfRefRank(b) || a.seq - b.seq);
    const deletes = known
        .filter((c) => c.op === "delete")
        .sort((a, b) => tableRank(b.table) - tableRank(a.table) || a.seq - b.seq);
    return [...upserts, ...deletes];
}

function applyChange(change: RemoteChange, myDeviceId: string): boolean {
    const def = tableDef(change.table)!;
    const localTs = latestLocalTimestamp(change.table, change.rowId);
    // Last-write-wins; equal timestamps break the tie by device id so that
    // every device converges on the same winner.
    const incomingWins =
        change.updatedAt > localTs || (change.updatedAt === localTs && change.deviceId > myDeviceId);
    if (!incomingWins) return false;

    if (change.op === "delete") {
        if (def.singletonId != null) return false; // settings rows are never deleted
        expoDb.runSync(`DELETE FROM ${def.name} WHERE uuid = ?`, [change.rowId]);
    } else if (!upsertRow(def, change)) {
        return false;
    }

    bumpRowVersion(change.table, change.rowId, change.updatedAt);
    // The incoming version won, so any queued local change to this row is obsolete.
    expoDb.runSync(`DELETE FROM sync_queue WHERE table_name = ? AND row_uuid = ?`, [
        change.table,
        change.rowId,
    ]);
    return true;
}

function upsertRow(def: SyncTableDef, change: RemoteChange): boolean {
    const data = change.data ?? {};
    const row: Record<string, unknown> = {};
    for (const col of tableColumns(def.name)) {
        if (col.name === "id" || col.name === "uuid" || !(col.name in data)) continue;
        let value = data[col.name] as unknown;
        const refTable = def.fks?.[col.name];
        if (refTable && value != null) {
            const ref = expoDb.getFirstSync<{ id: number }>(
                `SELECT id FROM ${refTable} WHERE uuid = ?`,
                [String(value)],
            );
            if (!ref) {
                if (col.notnull) return false; // required parent missing — skip row
                value = null;
            } else {
                value = ref.id;
            }
        }
        row[col.name] = value;
    }
    const names = Object.keys(row);
    if (names.length === 0) return false;

    const existing =
        def.singletonId != null
            ? { id: def.singletonId }
            : expoDb.getFirstSync<{ id: number }>(`SELECT id FROM ${def.name} WHERE uuid = ?`, [
                  change.rowId,
              ]);
    if (existing) {
        const result = expoDb.runSync(
            `UPDATE ${def.name} SET ${names.map((n) => `${n} = ?`).join(", ")} WHERE id = ?`,
            [...names.map((n) => row[n] as any), existing.id],
        );
        if (result.changes > 0) return true;
        // Singleton row unexpectedly missing — fall through and insert it.
        row.id = existing.id;
        names.push("id");
    }
    expoDb.runSync(
        `INSERT INTO ${def.name} (${[...names, "uuid"].join(", ")})
         VALUES (${[...names, "uuid"].map(() => "?").join(", ")})`,
        [...names.map((n) => row[n] as any), change.rowId],
    );
    return true;
}

// ── Push ───────────────────────────────────────────────────

async function pushAll(settings: SyncCredentials, deviceId: string): Promise<number> {
    const pending = collectPending();
    if (pending.length === 0) return 0;
    const maxQueueId =
        expoDb.getFirstSync<{ m: number | null }>(`SELECT MAX(id) AS m FROM sync_queue`)?.m ?? 0;

    const changes = buildPushChanges(pending);
    for (let i = 0; i < changes.length; i += PUSH_BATCH_SIZE) {
        await pushChanges(settings, deviceId, changes.slice(i, i + PUSH_BATCH_SIZE));
    }

    expoDb.withTransactionSync(() => {
        for (const c of changes) bumpRowVersion(c.table, c.rowId, c.updatedAt);
        // Entries queued while the push was in flight have higher ids and survive.
        expoDb.runSync(`DELETE FROM sync_queue WHERE id <= ?`, [maxQueueId]);
    });
    return changes.length;
}

/** Collapse the queue to one entry per row: latest op, newest timestamp. */
function collectPending(): PendingEntry[] {
    return expoDb.getAllSync<PendingEntry>(`
        SELECT q.table_name AS tableName, q.row_uuid AS rowUuid, q.op, m.maxTs AS updatedAt
        FROM sync_queue q
        JOIN (
            SELECT table_name, row_uuid, MAX(id) AS maxId, MAX(updated_at) AS maxTs
            FROM sync_queue GROUP BY table_name, row_uuid
        ) m ON q.id = m.maxId
    `);
}

function buildPushChanges(pending: PendingEntry[]): SyncChange[] {
    const upserts: (SyncChange & { selfRefRank: number })[] = [];
    const deletes: SyncChange[] = [];
    for (const entry of pending) {
        const def = tableDef(entry.tableName);
        if (!def) continue;
        const rowId = def.singletonId != null ? singletonUuid(def) : entry.rowUuid;
        if (entry.op === "delete") {
            if (def.singletonId == null) {
                deletes.push({ table: def.name, rowId, op: "delete", updatedAt: entry.updatedAt });
            }
            continue;
        }
        const data = serializeRow(def, entry.rowUuid);
        if (!data) {
            // Row vanished since it was queued — sync the deletion instead.
            if (def.singletonId == null) {
                deletes.push({ table: def.name, rowId, op: "delete", updatedAt: entry.updatedAt });
            }
            continue;
        }
        upserts.push({
            table: def.name,
            rowId,
            op: "upsert",
            updatedAt: entry.updatedAt,
            data,
            selfRefRank: def.selfRefColumn && data[def.selfRefColumn] != null ? 1 : 0,
        });
    }
    upserts.sort((a, b) => tableRank(a.table) - tableRank(b.table) || a.selfRefRank - b.selfRefRank);
    deletes.sort((a, b) => tableRank(b.table) - tableRank(a.table));
    return [...upserts.map(({ selfRefRank: _selfRefRank, ...c }) => c), ...deletes];
}

/** Read a row and encode it for the wire: no local ids, FKs as uuids. */
function serializeRow(def: SyncTableDef, rowUuid: string): Record<string, unknown> | null {
    const row =
        def.singletonId != null
            ? expoDb.getFirstSync<Record<string, unknown>>(
                  `SELECT * FROM ${def.name} WHERE id = ?`,
                  [def.singletonId],
              )
            : expoDb.getFirstSync<Record<string, unknown>>(
                  `SELECT * FROM ${def.name} WHERE uuid = ?`,
                  [rowUuid],
              );
    if (!row) return null;
    const data: Record<string, unknown> = {};
    for (const [col, value] of Object.entries(row)) {
        if (col === "id" || col === "uuid" || def.excludeColumns?.includes(col)) continue;
        const refTable = def.fks?.[col];
        if (refTable && value != null) {
            const ref = expoDb.getFirstSync<{ uuid: string | null }>(
                `SELECT uuid FROM ${refTable} WHERE id = ?`,
                [value as number],
            );
            data[col] = ref?.uuid ?? null;
        } else {
            data[col] = value;
        }
    }
    return data;
}

// ── Shared helpers ─────────────────────────────────────────

const tableDefs = new Map<string, SyncTableDef>(SYNC_TABLES.map((t) => [t.name, t]));
const tableRanks = new Map<string, number>(SYNC_TABLES.map((t, i) => [t.name, i]));

function tableDef(name: string): SyncTableDef | undefined {
    return tableDefs.get(name);
}

function tableRank(name: string): number {
    return tableRanks.get(name) ?? 0;
}

function selfRefRank(change: RemoteChange): number {
    const col = tableDef(change.table)?.selfRefColumn;
    return col && change.data?.[col] != null ? 1 : 0;
}

interface ColumnInfo {
    name: string;
    notnull: boolean;
}

const columnCache = new Map<string, ColumnInfo[]>();

function tableColumns(table: string): ColumnInfo[] {
    let cols = columnCache.get(table);
    if (!cols) {
        cols = expoDb
            .getAllSync<{ name: string; notnull: number }>(`PRAGMA table_info(${table})`)
            .map((c) => ({ name: c.name, notnull: c.notnull === 1 }));
        columnCache.set(table, cols);
    }
    return cols;
}

/** Newest timestamp we know for a row locally (pending edits or applied version). */
function latestLocalTimestamp(table: string, rowUuid: string): number {
    const queued = expoDb.getFirstSync<{ ts: number | null }>(
        `SELECT MAX(updated_at) AS ts FROM sync_queue WHERE table_name = ? AND row_uuid = ?`,
        [table, rowUuid],
    );
    const version = expoDb.getFirstSync<{ ts: number | null }>(
        `SELECT updated_at AS ts FROM sync_row_versions WHERE table_name = ? AND row_uuid = ?`,
        [table, rowUuid],
    );
    return Math.max(queued?.ts ?? 0, version?.ts ?? 0);
}

function bumpRowVersion(table: string, rowUuid: string, updatedAt: number) {
    expoDb.runSync(
        `INSERT INTO sync_row_versions (table_name, row_uuid, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(table_name, row_uuid) DO UPDATE SET updated_at = MAX(updated_at, excluded.updated_at)`,
        [table, rowUuid, updatedAt],
    );
}
