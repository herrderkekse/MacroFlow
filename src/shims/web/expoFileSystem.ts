// Web stand-in for expo-file-system's object API (screen gallery only).
// Nothing is read or written. The auto-backup folder lists two made-up backups
// so the Backup screen shows its populated state.

type Parent = { uri: string } | string;

function join(parts: Parent[]): string {
    return parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/").replace(/\/+/g, "/");
}

const DAY = 24 * 60 * 60 * 1000;

export class File {
    uri: string;
    constructor(...parts: Parent[]) { this.uri = join(parts); }
    get exists() { return false; }
    get name() { return this.uri.split("/").pop() ?? ""; }
    create() { }
    copy() { }
    delete() { }
    write() { }
    async text(): Promise<string> { throw new Error("File access is not available in the screen gallery."); }
}

export class Directory {
    uri: string;
    constructor(...parts: Parent[]) { this.uri = join(parts); }
    get exists() { return this.uri.endsWith("/autobackups"); }
    create() { }
    delete() { }
    list(): File[] {
        if (!this.exists) return [];
        const now = Date.now();
        return [now - DAY, now - 4 * DAY].map((t) => new File(this, `backup-${t}.db`));
    }
}

export const Paths = {
    document: { uri: "file:///gallery/document" },
    cache: { uri: "file:///gallery/cache" },
};
