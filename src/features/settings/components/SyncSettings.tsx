import Button from "@/src/shared/atoms/Button";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { syncNow } from "../services/syncEngine";
import { getSyncStatus, loadSyncSettings, type SyncStatus } from "../services/syncSettings";

interface Props {
    colors: ThemeColors;
}

const ACCOUNT_ROUTE = "/(tabs)/account" as unknown as Href;

export default function SyncSettings({ colors }: Props) {
    const { t } = useTranslation();
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

    return (
        <View>
            <Text style={styles.sectionLabel}>{t("settings.sync")}</Text>
            <Text style={styles.description}>{t("settings.syncDescription")}</Text>

            {configured ? (
                <>
                    <View style={styles.accountRow}>
                        <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
                        <View style={styles.accountText}>
                            <Text style={styles.accountName} numberOfLines={1}>
                                {username}
                            </Text>
                            <Text style={styles.accountSub}>{t("settings.syncSignedInSubtitle")}</Text>
                        </View>
                        <Button
                            title={t("settings.syncManageAccount")}
                            variant="outline"
                            onPress={() => router.push(ACCOUNT_ROUTE)}
                        />
                    </View>

                    <Button title={t("settings.syncNow")} onPress={handleSyncNow} loading={syncing} />

                    {status && (
                        <View style={styles.statusBlock}>
                            <Text style={styles.statusText}>
                                {status.lastSyncAt
                                    ? t("settings.syncLastSync", {
                                          date: new Date(status.lastSyncAt).toLocaleString(),
                                      })
                                    : t("settings.syncNeverSynced")}
                            </Text>
                            {status.pendingCount > 0 && (
                                <Text style={styles.statusText}>
                                    {t("settings.syncPendingChanges", { count: status.pendingCount })}
                                </Text>
                            )}
                            {status.lastError && (
                                <Text style={styles.errorText}>{status.lastError}</Text>
                            )}
                        </View>
                    )}
                </>
            ) : (
                <>
                    <Text style={styles.notSignedIn}>{t("settings.syncNotSignedIn")}</Text>
                    <Button
                        title={t("settings.syncSetUpAccount")}
                        onPress={() => router.push(ACCOUNT_ROUTE)}
                    />
                </>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.md,
        },
        description: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        accountRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        accountText: {
            flex: 1,
        },
        accountName: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
        },
        accountSub: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
        },
        notSignedIn: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        statusBlock: {
            marginTop: spacing.md,
            gap: spacing.xs,
        },
        statusText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        errorText: {
            fontSize: fontSize.sm,
            color: colors.danger,
        },
    });
}
