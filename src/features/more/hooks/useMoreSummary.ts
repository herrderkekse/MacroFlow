import { getLoggedDayCount, getStreak } from "@/src/features/log/services/logDb";
import { getPhotoCount } from "@/src/features/photos/services/photoDb";
import { listAutoBackups } from "@/src/features/settings/services/autoBackup";
import { getSyncStatus, getSyncUsername } from "@/src/features/settings/services/syncSettings";
import logger from "@/src/utils/logger";
import Constants from "expo-constants";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export interface MoreSummary {
    /** Sync account name; null while the app is local-only. */
    username: string | null;
    lastSyncAt: number | null;
    streak: number;
    daysLogged: number;
    photos: number;
    lastBackupAt: number | null;
    version: string | null;
}

const EMPTY: MoreSummary = {
    username: null, lastSyncAt: null, streak: 0, daysLogged: 0, photos: 0, lastBackupAt: null, version: null,
};

function lastBackupAt(): number | null {
    try {
        return listAutoBackups()[0]?.timestamp ?? null;
    } catch (e) {
        logger.warn("[More] Could not list backups", e);
        return null;
    }
}

/** What the More tab's header card shows; re-read whenever the tab comes into view. */
export function useMoreSummary(): MoreSummary {
    const [summary, setSummary] = useState<MoreSummary>(EMPTY);

    useFocusEffect(
        useCallback(() => {
            const username = getSyncUsername();
            setSummary({
                username,
                lastSyncAt: username ? getSyncStatus().lastSyncAt : null,
                streak: getStreak(),
                daysLogged: getLoggedDayCount(),
                photos: getPhotoCount(),
                lastBackupAt: lastBackupAt(),
                version: Constants.expoConfig?.version ?? null,
            });
        }, []),
    );

    return summary;
}
