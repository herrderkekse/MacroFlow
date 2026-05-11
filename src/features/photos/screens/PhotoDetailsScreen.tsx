import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

export default function PhotoDetailsScreen() {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams<{ count?: string }>();
    const count = Number(params.count ?? 0) || 0;

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>{t("log.photoDetailsTitle")}</Text>
                <Text style={styles.body}>{t("log.photoDetailsSummary", { count })}</Text>
                <Text style={styles.hint}>{t("log.photoDetailsHint")}</Text>
            </View>
            <Button title={t("common.done")} onPress={() => router.back()} />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            padding: spacing.md,
            justifyContent: "space-between",
        },
        card: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            padding: spacing.md,
            gap: spacing.sm,
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        body: {
            fontSize: fontSize.md,
            color: colors.text,
        },
        hint: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
    });
}
