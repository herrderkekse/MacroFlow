// Web build (screen gallery only): stands in for expo-sqlite's persistent,
// OPFS-backed AccessHandlePoolVFS, so every database lives in memory.
//
// AccessHandlePoolVFS locks a pool of OPFS files exclusively when the SQLite
// worker starts, so only one tab or frame per origin can run SQLite at a time,
// and the gallery runs one per screen. Each frame gets its own throwaway
// database instead, seeded with sample data in index.web.js.
import { MemoryVFS } from "expo-sqlite/web/wa-sqlite/MemoryVFS";

export class AccessHandlePoolVFS extends MemoryVFS {
    static async create(name, module) {
        const vfs = new AccessHandlePoolVFS(name, module);
        await vfs.isReady();
        return vfs;
    }
}
