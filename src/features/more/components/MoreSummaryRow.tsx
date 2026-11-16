import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MoreSummary } from "../hooks/useMoreSummary";

interface MoreSummaryRowProps {
    summary: MoreSummary;
    onPress: () => void;
}

function initials(name: string): string {
    const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
    return letters.toUpperCase();
}

/** Who this is and how it is going: the account, days logged and the streak. Opens the account. */
export default function MoreSummaryRow({ summary, onPress }: MoreSummaryRowProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();

    const facts = [t("more.card.daysLogged", { count: summary.daysLogged })];
    if (summary.streak > 0) facts.push(t("more.card.streak", { count: summary.streak }));

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
        >
            <View style={styles.avatar}>
                {summary.username ? (
                    <Text style={styles.initials}>{initials(summary.username)}</Text>
                ) : (
                    <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                )}
            </View>
            <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>{summary.username ?? t("more.card.localProfile")}</Text>
                <Text style={styles.facts} numberOfLines={1}>{facts.join(" · ")}</Text>
            </View>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
        pressed: { opacity: 0.6 },
        avatar: {
            width: 36,
            height: 36,
            borderRadius: borderRadius.full,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },
        initials: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary },
        text: { flex: 1 },
        name: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        facts: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
    });
}
