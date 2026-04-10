import { useCallback, useEffect, useState } from "react";
import type { AutoBackupInfo } from "../services/autoBackup";
import { listAutoBackups, restoreFromBackup, shareBackup } from "../services/autoBackup";
import { expoDb } from "@/src/services/db";

export function useAutoBackups() {
    const [backups, setBackups] = useState<AutoBackupInfo[]>([]);
    const [restoringUri, setRestoringUri] = useState<string | null>(null);
    const [sharingUri, setSharingUri] = useState<string | null>(null);

    const refresh = useCallback(() => {
        setBackups(listAutoBackups());
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const share = useCallback(async (uri: string) => {
        setSharingUri(uri);
        try {
            await shareBackup(uri);
        } finally {
            setSharingUri(null);
        }
    }, []);

    const restore = useCallback((uri: string) => {
        setRestoringUri(uri);
        try {
            restoreFromBackup(uri, expoDb);
        } finally {
            setRestoringUri(null);
        }
    }, []);

    return { backups, refresh, share, restore, restoringUri, sharingUri };
}
