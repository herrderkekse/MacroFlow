import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
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
            <Ionicons name="archive-outline" size={20} color={colors.textSecondary} style={styles.icon} />
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
            <View style={styles.actions}>
                <Pressable onPress={onShare} disabled={isSharingThis} style={styles.iconBtn} hitSlop={8}>
                    {isSharingThis
                        ? <ActivityIndicator size={16} color={colors.primary} />
                        : <Ionicons name="share-outline" size={20} color={colors.primary} />}
                </Pressable>
                <Pressable onPress={onRestore} disabled={isRestoringThis} style={styles.iconBtn} hitSlop={8}>
                    {isRestoringThis
                        ? <ActivityIndicator size={16} color={colors.primary} />
                        : <Ionicons name="refresh-outline" size={20} color={colors.primary} />}
                </Pressable>
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        icon: { marginRight: spacing.sm },
        label: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.text,
        },
        actions: {
            flexDirection: "row",
            gap: spacing.sm,
        },
        iconBtn: { padding: 4 },
    });
}
