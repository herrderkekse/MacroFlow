import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const DB_NAME = "macroflow.db";
const BACKUP_PREFIX = "backup-";
const MAX_BACKUPS = 5;

export interface AutoBackupInfo {
    filename: string;
    timestamp: number;
    uri: string;
}

function getBackupDir(): Directory {
    return new Directory(Paths.document, "autobackups");
}

function getSourceDbFile(): File {
    return new File(Paths.document, "SQLite", DB_NAME);
}

export function createAutoBackup(): void {
    const sourceFile = getSourceDbFile();
    if (!sourceFile.exists) return;

    const backupDir = getBackupDir();
    if (!backupDir.exists) {
        backupDir.create({ intermediates: true });
    }

    const backupFile = new File(backupDir, `${BACKUP_PREFIX}${Date.now()}.db`);
    sourceFile.copy(backupFile);

    pruneOldBackups();
}

export function listAutoBackups(): AutoBackupInfo[] {
    const backupDir = getBackupDir();
    if (!backupDir.exists) return [];

    return backupDir
        .list()
        .filter((f): f is File => {
            if (!(f instanceof File)) return false;
            const name = f.uri.split("/").pop() ?? "";
            return name.startsWith(BACKUP_PREFIX) && name.endsWith(".db");
        })
        .map((f) => {
            const filename = f.uri.split("/").pop() ?? f.uri;
            const epochStr = filename.replace(BACKUP_PREFIX, "").replace(".db", "");
            const timestamp = parseInt(epochStr, 10) || 0;
            return { filename, timestamp, uri: f.uri };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
}

function pruneOldBackups(): void {
    const backups = listAutoBackups();
    for (const backup of backups.slice(MAX_BACKUPS)) {
        try {
            new File(backup.uri).delete();
        } catch { /* ignore */ }
    }
}

export async function shareBackup(uri: string): Promise<void> {
    await Sharing.shareAsync(uri, {
        mimeType: "application/octet-stream",
        dialogTitle: "Export Backup",
    });
}

export function restoreFromBackup(backupUri: string, expoDb: { closeSync: () => void }): void {
    const backupFile = new File(backupUri);
    if (!backupFile.exists) {
        throw new Error("Backup file not found.");
    }

    const dbFile = getSourceDbFile();
    expoDb.closeSync();

    if (dbFile.exists) {
        dbFile.delete();
    }
    backupFile.copy(dbFile);
}
