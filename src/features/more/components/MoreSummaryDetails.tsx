import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatAgo } from "../helpers/formatAgo";
import type { MoreSummary } from "../hooks/useMoreSummary";

/** Where the data lives, a few counts, and when it was last backed up. */
export default function MoreSummaryDetails({ summary }: { summary: MoreSummary }) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();

    const signedIn = summary.username != null;
    const syncHint = summary.lastSyncAt != null
        ? t("more.card.syncedAgo", { when: formatAgo(t, summary.lastSyncAt) })
        : t("more.card.notSyncedYet");
    const stats = [
        { key: "streak", value: summary.streak, label: t("more.card.statStreak") },
        { key: "days", value: summary.daysLogged, label: t("more.card.statDays") },
        { key: "photos", value: summary.photos, label: t("more.card.statPhotos") },
    ];
    const footer = [
        summary.lastBackupAt != null
            ? t("more.card.lastBackup", { when: formatAgo(t, summary.lastBackupAt) })
            : t("more.card.noBackup"),
    ];
    if (summary.version) footer.push(t("more.card.version", { version: summary.version }));

    return (
        <View style={styles.root}>
            <View style={styles.status}>
                <Ionicons
                    name={signedIn ? "cloud-done-outline" : "lock-closed-outline"}
                    size={15}
                    color={colors.textSecondary}
                />
                <Text style={styles.statusLabel}>{signedIn ? t("more.card.synced") : t("more.card.localOnly")}</Text>
                <Text style={styles.caption} numberOfLines={1}>
                    {signedIn ? syncHint : t("more.card.localOnlyHint")}
                </Text>
            </View>
            <View style={styles.stats}>
                {stats.map((stat) => (
                    <View key={stat.key} style={styles.stat}>
                        <Text style={styles.statValue}>{stat.value.toLocaleString()}</Text>
                        <Text style={styles.caption} numberOfLines={1}>{stat.label}</Text>
                    </View>
                ))}
            </View>
            <Text style={styles.caption}>{footer.join(" · ")}</Text>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        root: { gap: spacing.sm + 4 },
        status: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
        statusLabel: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary },
        caption: { flexShrink: 1, fontSize: fontSize.xs, color: colors.textTertiary },
        stats: { flexDirection: "row", gap: spacing.sm },
        stat: {
            flex: 1,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm + 2,
        },
        statValue: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
            marginBottom: 2,
        },
    });
}
