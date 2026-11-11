import EmptyState from "@/src/shared/atoms/EmptyState";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import type { AppearanceMode, ExerciseTimerSound, UnitSystem } from "@/src/shared/types";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import AutoBackupItem from "../components/AutoBackupItem";
import { useAutoBackups } from "../hooks/useAutoBackups";
import { exportData, importData } from "../services/importExport";
import { getGoals } from "../services/settingsDb";

export default function BackupScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const setUnitSystem = useAppStore((s) => s.setUnitSystem);
    const setAppearanceMode = useAppStore((s) => s.setAppearanceMode);
    const setKeepAwakeInWorkout = useAppStore((s) => s.setKeepAwakeInWorkout);
    const setExerciseTimerSound = useAppStore((s) => s.setExerciseTimerSound);

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
                setKeepAwakeInWorkout(g.keep_awake !== 0);
                if (g.exercise_timer_sound === "off" || g.exercise_timer_sound === "on" || g.exercise_timer_sound === "bluetooth") {
                    setExerciseTimerSound(g.exercise_timer_sound as ExerciseTimerSound);
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

    const spinner = <ActivityIndicator size="small" color={colors.textSecondary} />;

    return (
        <View style={styles.screen}>
            <ScreenHeader title={t("more.backup")} />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionLabel style={styles.firstLabel}>{t("settings.data")}</SectionLabel>
                <ListGroup>
                    <ListRow
                        icon="share-outline"
                        title={t("settings.exportData")}
                        subtitle={t("settings.exportDescription")}
                        onPress={handleExport}
                        disabled={exporting}
                        right={exporting ? spinner : undefined}
                    />
                    <ListRow
                        icon="download-outline"
                        title={t("settings.importData")}
                        subtitle={t("settings.importDescription")}
                        onPress={handleImportConfirm}
                        disabled={importing}
                        right={importing ? spinner : undefined}
                    />
                </ListGroup>

                <SectionLabel>{t("settings.autoBackups")}</SectionLabel>
                {backups.length === 0 ? (
                    <EmptyState icon="archive-outline" title={t("settings.autoBackupsEmpty")} />
                ) : (
                    <ListGroup>
                        {backups.map((item) => (
                            <AutoBackupItem
                                key={item.uri}
                                item={item}
                                isSharingThis={sharingUri === item.uri}
                                isRestoringThis={restoringUri === item.uri}
                                onShare={() => share(item.uri)}
                                onRestore={() => handleRestoreConfirm(item.uri)}
                            />
                        ))}
                    </ListGroup>
                )}
                <Text style={styles.note}>{t("settings.autoBackupsDescription")}</Text>
            </ScrollView>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl },
        firstLabel: { marginTop: spacing.sm },
        note: {
            fontSize: fontSize.xs,
            lineHeight: 17,
            color: colors.textSecondary,
            marginTop: spacing.sm,
            marginHorizontal: spacing.xs,
        },
    });
}
