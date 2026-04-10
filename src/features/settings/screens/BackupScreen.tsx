import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import type { AppearanceMode, UnitSystem } from "@/src/shared/types";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AutoBackupItem from "../components/AutoBackupItem";
import { useAutoBackups } from "../hooks/useAutoBackups";
import { exportData, importData } from "../services/importExport";
import { getGoals } from "../services/settingsDb";

export default function BackupScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const setUnitSystem = useAppStore((s) => s.setUnitSystem);
    const setAppearanceMode = useAppStore((s) => s.setAppearanceMode);

    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    const { backups, share, restore, restoringUri, sharingUri } = useAutoBackups();

    async function handleExport() {
        try {
            setExporting(true);
            await exportData();
        } catch (e: any) {
            Alert.alert(t("settings.exportFailed"), e.message ?? t("common.unknownError"));
        } finally {
            setExporting(false);
        }
    }

    function handleImportConfirm() {
        Alert.alert(
            t("settings.importTitle"),
            t("settings.importWarning"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("settings.importData"), style: "destructive", onPress: handleImport },
            ],
        );
    }

    async function handleImport() {
        try {
            setImporting(true);
            const { inserted } = await importData();
            const g = getGoals();
            if (g) {
                if (g.unit_system === "metric" || g.unit_system === "imperial") {
                    setUnitSystem(g.unit_system as UnitSystem);
                }
                if (g.appearance_mode === "light" || g.appearance_mode === "dark" || g.appearance_mode === "system") {
                    setAppearanceMode(g.appearance_mode as AppearanceMode);
                }
            }
            Alert.alert(
                t("settings.importComplete"),
                t("settings.recordsRestored_other", { count: inserted }),
            );
        } catch (e: any) {
            if (e.message !== "cancelled") {
                Alert.alert(t("settings.importFailed"), e.message ?? t("common.unknownError"));
            }
        } finally {
            setImporting(false);
        }
    }

    function handleRestoreConfirm(uri: string) {
        Alert.alert(
            t("settings.autoBackupRestoreTitle"),
            t("settings.autoBackupRestoreWarning"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("settings.autoBackupRestore"),
                    style: "destructive",
                    onPress: () => {
                        try {
                            restore(uri);
                            Alert.alert(
                                t("settings.autoBackupRestoreComplete"),
                                t("settings.autoBackupRestoreCompleteMessage"),
                            );
                        } catch (e: any) {
                            Alert.alert(t("settings.autoBackupRestoreFailed"), e.message ?? t("common.unknownError"));
                        }
                    },
                },
            ],
        );
    }

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        >
            <View style={styles.headerRow}>
                <Pressable onPress={() => router.navigate("/(tabs)/more" as any)} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </Pressable>
                <Text style={styles.heading}>{t("more.backup")}</Text>
            </View>

            <Text style={styles.sectionLabel}>{t("settings.data")}</Text>
            <Text style={styles.subLabel}>{t("settings.dataDescription")}</Text>

            <View style={styles.row}>
                <Button
                    title={t("settings.exportData")}
                    variant="outline"
                    onPress={handleExport}
                    loading={exporting}
                    style={{ flex: 1 }}
                />
                <Button
                    title={t("settings.importData")}
                    variant="outline"
                    onPress={handleImportConfirm}
                    loading={importing}
                    style={{ flex: 1 }}
                />
            </View>

            <Text style={styles.sectionLabel}>{t("settings.autoBackups")}</Text>
            <Text style={styles.subLabel}>{t("settings.autoBackupsDescription")}</Text>

            {backups.length === 0 ? (
                <Text style={styles.emptyLabel}>{t("settings.autoBackupsEmpty")}</Text>
            ) : (
                backups.map((item) => (
                    <AutoBackupItem
                        key={item.uri}
                        item={item}
                        isSharingThis={sharingUri === item.uri}
                        isRestoringThis={restoringUri === item.uri}
                        onShare={() => share(item.uri)}
                        onRestore={() => handleRestoreConfirm(item.uri)}
                    />
                ))
            )}
        </ScrollView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: 40 },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        backBtn: { padding: 4 },
        heading: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
        },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.md,
        },
        subLabel: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        row: {
            flexDirection: "row",
            gap: spacing.sm,
        },
        emptyLabel: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            fontStyle: "italic",
        },
    });
}
