// Final "All caught up" screen: recap of every pending decision plus the
// headline count. Confirm is the ONLY thing that writes to the DB (via the
// hook's commit); Start over resets the queue.

import type { Decision } from "@/src/features/share/services/importPlan";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
    decisions: Decision[];
    counts: { templates: number; items: number; skipped: number };
    onConfirm: () => void;
    onReset: () => void;
    saving: boolean;
    colors: ThemeColors;
}

export default function ImportSummary({ decisions, counts, onConfirm, onReset, saving, colors }: Props) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const toneColor = (tone: Decision["tone"]) =>
        tone === "success" ? colors.success : tone === "primary" ? colors.primary : colors.textTertiary;

    const headline = [
        t("share.import.summaryTemplates", { count: counts.templates }),
        t("share.import.summaryItems", { count: counts.items }),
    ].join(" · ");

    return (
        <View style={styles.card}>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.iconCircle}>
                    <Ionicons name="checkmark-done" size={30} color={colors.success} />
                </View>
                <Text style={styles.title}>{t("share.import.summaryTitle")}</Text>
                <Text style={styles.subtitle}>{headline}</Text>
                {counts.skipped > 0 ? (
                    <Text style={styles.skipped}>{t("share.import.summarySkipped", { count: counts.skipped })}</Text>
                ) : null}

                <View style={styles.list}>
                    {decisions.map((d, i) => {
                        const color = toneColor(d.tone);
                        const params = d.summaryParams
                            ? { ...d.summaryParams, meal: d.summaryParams.meal ? t(`meal.${d.summaryParams.meal}`) : undefined }
                            : undefined;
                        return (
                            <View key={`${d.key}-${i}`} style={styles.row}>
                                <View style={[styles.rowIcon, { backgroundColor: colors.background }]}>
                                    <Ionicons name={d.icon as never} size={17} color={color} />
                                </View>
                                <View style={styles.rowInfo}>
                                    <Text style={styles.rowTitle} numberOfLines={1}>
                                        {d.title}
                                    </Text>
                                    <Text style={styles.rowLabel} numberOfLines={1}>
                                        {t(d.summaryKey, params)}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable onPress={onReset} disabled={saving} style={styles.resetBtn}>
                    <Ionicons name="refresh-outline" size={17} color={colors.textSecondary} />
                    <Text style={styles.resetText}>{t("share.import.startOver")}</Text>
                </Pressable>
                <Pressable onPress={onConfirm} disabled={saving} style={styles.confirmBtn}>
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.confirmText}>{t("share.import.confirm")}</Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
        },
        body: { padding: spacing.lg },
        iconCircle: {
            width: 56,
            height: 56,
            borderRadius: 999,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.md,
        },
        title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
        subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
        skipped: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
        list: { marginTop: spacing.md },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.sm + 4,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        rowIcon: { width: 34, height: 34, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
        rowInfo: { flex: 1 },
        rowTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        rowLabel: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },
        footer: {
            flexDirection: "row",
            gap: spacing.sm,
            padding: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        resetBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        resetText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        confirmBtn: {
            flex: 2,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.primary,
        },
        confirmText: { fontSize: fontSize.md, fontWeight: "700", color: "#fff" },
    });
}
