import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { syncNow } from "../services/syncEngine";
import { testConnection } from "../services/syncClient";
import {
    getSyncStatus,
    loadSyncSettings,
    saveSyncSettings,
    type SyncStatus,
} from "../services/syncSettings";

interface Props {
    colors: ThemeColors;
}

export default function SyncSettings({ colors }: Props) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [url, setUrl] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [configured, setConfigured] = useState(false);
    const [status, setStatus] = useState<Omit<SyncStatus, "configured"> | null>(null);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const settings = await loadSyncSettings();
            if (cancelled) return;
            if (settings) {
                setUrl(settings.url);
                setUsername(settings.username);
                setPassword(settings.password);
                setConfigured(true);
            }
            setStatus(getSyncStatus());
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    function fieldsValid(): boolean {
        if (url.trim() && username.trim() && password) return true;
        Alert.alert(t("settings.sync"), t("settings.syncFieldsRequired"));
        return false;
    }

    async function handleSave() {
        if (!fieldsValid()) return;
        try {
            setSaving(true);
            await saveSyncSettings({ url, username, password });
            setConfigured(true);
            Alert.alert(t("settings.sync"), t("settings.syncSaved"));
        } catch (e: any) {
            Alert.alert(t("settings.sync"), e.message ?? t("common.unknownError"));
        } finally {
            setSaving(false);
        }
    }

    async function handleTest() {
        if (!fieldsValid()) return;
        try {
            setTesting(true);
            await testConnection({ url: url.trim(), username: username.trim(), password });
            Alert.alert(t("settings.sync"), t("settings.syncTestSuccess"));
        } catch (e: any) {
            Alert.alert(t("settings.syncTestFailed"), e.message ?? t("common.unknownError"));
        } finally {
            setTesting(false);
        }
    }

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

            <Input
                label={t("settings.syncUrl")}
                value={url}
                onChangeText={setUrl}
                placeholder="https://sync.example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                containerStyle={styles.field}
            />
            <Input
                label={t("settings.syncUsername")}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={styles.field}
            />
            <Input
                label={t("settings.syncPassword")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                containerStyle={styles.field}
            />

            <View style={styles.buttonRow}>
                <Button
                    title={t("settings.syncTest")}
                    variant="outline"
                    onPress={handleTest}
                    loading={testing}
                    style={{ flex: 1 }}
                />
                <Button
                    title={t("settings.syncSave")}
                    variant="outline"
                    onPress={handleSave}
                    loading={saving}
                    style={{ flex: 1 }}
                />
            </View>

            <Button
                title={t("settings.syncNow")}
                onPress={handleSyncNow}
                loading={syncing}
                disabled={!configured}
            />

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
                    {status.lastError && <Text style={styles.errorText}>{status.lastError}</Text>}
                </View>
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
        field: {
            marginBottom: spacing.md,
        },
        buttonRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.sm,
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
