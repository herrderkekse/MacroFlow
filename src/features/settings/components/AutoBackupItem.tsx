import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { AutoBackupInfo } from "../services/autoBackup";

interface Props {
    item: AutoBackupInfo;
    isSharingThis: boolean;
    isRestoringThis: boolean;
    onShare: () => void;
    onRestore: () => void;
}

export default function AutoBackupItem({ item, isSharingThis, isRestoringThis, onShare, onRestore }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const date = new Date(item.timestamp);
    const label = t("settings.autoBackupLabel", {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    return (
        <View style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
            {isSharingThis ? (
                <ActivityIndicator size="small" color={colors.textSecondary} style={styles.spinner} />
            ) : (
                <IconButton icon="share-outline" label={t("common.share")} onPress={onShare} />
            )}
            {isRestoringThis ? (
                <ActivityIndicator size="small" color={colors.textSecondary} style={styles.spinner} />
            ) : (
                <IconButton icon="refresh-outline" label={t("settings.autoBackupRestore")} onPress={onRestore} />
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            minHeight: 56,
            paddingLeft: screenPadding,
            paddingRight: spacing.sm,
        },
        label: { flex: 1, fontSize: fontSize.md, fontWeight: "500", color: colors.text },
        spinner: { width: 40, height: 40 },
    });
}
