// Web build (screen gallery only): expo-sqlite's web/WorkerChannel.ts with two
// fixes (expo-sqlite 57.0.5). metro.config.js routes expo-sqlite's own imports
// of ./WorkerChannel here; the rest is re-exported from the original.
//
// 1. sendWorkerResult writes the result length with
//      resultArray.set(new Uint32Array([length]), 0)
//    into a Uint8Array, which copies element-wise and keeps only the low byte,
//    so every synchronous result longer than 255 bytes arrives truncated.
// 2. invokeWorkerSync gives up after a fixed number of spin iterations, which
//    is too short while other gallery frames keep the CPU busy. It now waits
//    up to SYNC_TIMEOUT_MS of wall-clock time, and reuses its buffers.
import { deserialize, serialize } from "expo-sqlite/web/SyncSerializer";

export { invokeWorkerAsync, workerMessageHandler } from "expo-sqlite/web/WorkerChannel";

const PENDING = 1;

const RESOLVED = 2;

/**
 * @param {{ id: number, result: unknown, error: Error | null,
 *   syncTrait?: { lockBuffer: SharedArrayBuffer, resultBuffer: SharedArrayBuffer } }} message
 */
export function sendWorkerResult({ id, result, error, syncTrait }) {
    if (syncTrait) {
        const { lockBuffer, resultBuffer } = syncTrait;
        const lock = new Int32Array(lockBuffer);
        const resultJson = error != null ? serialize({ error }) : serialize({ result });
        const resultBytes = new TextEncoder().encode(resultJson);
        new DataView(resultBuffer).setUint32(0, resultBytes.length, true); // the fix
        new Uint8Array(resultBuffer).set(resultBytes, 4);
        Atomics.store(lock, 0, RESOLVED);
    } else if (result) {
        self.postMessage({ id, result });
    } else {
        self.postMessage({ id, error });
    }
}

const SYNC_TIMEOUT_MS = 10_000;
let syncMessageId = 0; // only echoed back by the worker; sync calls ignore it

// Sync calls block the main thread, so one call is in flight at a time and
// the buffers can be reused. (The original allocates 1 MB per call, which adds
// up fast with a whole gallery of app instances in one tab.)
const lockBuffer = new SharedArrayBuffer(4);
const lock = new Int32Array(lockBuffer);
const resultBuffer = new SharedArrayBuffer(1024 * 1024);

/** Main thread → worker, blocking until the worker answers. */
export function invokeWorkerSync(worker, type, data) {
    Atomics.store(lock, 0, PENDING);
    worker.postMessage({ type, id: syncMessageId++, data, isSync: true, lockBuffer, resultBuffer });

    const deadline = performance.now() + SYNC_TIMEOUT_MS;
    while (Atomics.load(lock, 0) === PENDING) {
        if (performance.now() > deadline) throw new Error("Sync operation timeout");
        if (typeof Atomics.pause === "function") Atomics.pause();
    }

    const length = new DataView(resultBuffer).getUint32(0, true);
    const resultJson = new TextDecoder().decode(new Uint8Array(resultBuffer, 4, length).slice());
    const { result, error } = deserialize(resultJson);
    if (error) throw new Error(error);
    return result;
}
