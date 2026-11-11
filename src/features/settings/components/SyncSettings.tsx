import SectionLabel from "@/src/shared/atoms/SectionLabel";
import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { syncNow } from "../services/syncEngine";
import { getSyncStatus, loadSyncSettings, type SyncStatus } from "../services/syncSettings";

const ACCOUNT_ROUTE = "/settings/account" as unknown as Href;

export default function SyncSettings() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const router = useRouter();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [configured, setConfigured] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const [status, setStatus] = useState<Omit<SyncStatus, "configured"> | null>(null);
    const [syncing, setSyncing] = useState(false);

    // Re-read on focus so returning from the Account screen reflects a fresh
    // sign-in or sign-out without needing to reopen Settings.
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                const settings = await loadSyncSettings();
                if (cancelled) return;
                setConfigured(!!settings);
                setUsername(settings?.username ?? null);
                setStatus(getSyncStatus());
            })();
            return () => {
                cancelled = true;
            };
        }, []),
    );

    async function handleSyncNow() {
        try {
            setSyncing(true);
            const result = await syncNow();
            setStatus(getSyncStatus());
            Alert.alert(
                t("settings.syncComplete"),
                t("settings.syncCompleteMessage", { pushed: result.pushed, pulled: result.pulled }),
            );
        } catch (e: any) {
            setStatus(getSyncStatus());
            Alert.alert(t("settings.syncFailed"), e.message ?? t("common.unknownError"));
        } finally {
            setSyncing(false);
        }
    }

    const statusLine = status
        ? status.lastSyncAt
            ? t("settings.syncLastSync", { date: new Date(status.lastSyncAt).toLocaleString() })
            : t("settings.syncNeverSynced")
        : undefined;

    return (
        <View>
            <SectionLabel>{t("settings.sync")}</SectionLabel>
            {configured ? (
                <>
                    <ListGroup>
                        <ListRow
                            icon="person-circle-outline"
                            title={username ?? ""}
                            subtitle={t("settings.syncSignedInSubtitle")}
                            value={t("settings.syncManageAccount")}
                            onPress={() => router.push(ACCOUNT_ROUTE)}
                        />
                        <ListRow
                            icon="sync-outline"
                            title={t("settings.syncNow")}
                            subtitle={statusLine}
                            onPress={handleSyncNow}
                            disabled={syncing}
                            right={syncing ? <ActivityIndicator size="small" color={colors.textSecondary} /> : undefined}
                            showChevron={false}
                        />
                    </ListGroup>
                    {status && status.pendingCount > 0 && (
                        <Text style={styles.note}>{t("settings.syncPendingChanges", { count: status.pendingCount })}</Text>
                    )}
                    {status?.lastError && <Text style={[styles.note, styles.error]}>{status.lastError}</Text>}
                </>
            ) : (
                <ListGroup>
                    <ListRow
                        icon="cloud-outline"
                        title={t("settings.syncSetUpAccount")}
                        subtitle={t("settings.syncNotSignedIn")}
                        onPress={() => router.push(ACCOUNT_ROUTE)}
                    />
                </ListGroup>
            )}
            <Text style={styles.note}>{t("settings.syncDescription")}</Text>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        note: {
            fontSize: fontSize.xs,
            lineHeight: 17,
            color: colors.textSecondary,
            marginTop: spacing.sm,
            marginHorizontal: spacing.xs,
        },
        error: { color: colors.danger },
    });
}
