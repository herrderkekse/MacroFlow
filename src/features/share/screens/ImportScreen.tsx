// Landing screen for share deep links (macroflow://share/<token>?origin=…).
// Fetches the shared payload, then hands off to the import queue where the user
// walks through each shared item and decides what to do with it. Nothing is
// written to the DB until they confirm on the summary. Rendered full-screen
// with floating cards so it reads as a modal even when a deep link opens the
// app cold with no screen underneath.

import ImportQueueView from "@/src/features/share/components/ImportQueueView";
import type { FetchedShare } from "@/src/features/share/services/shareClient";
import { fetchSharedContent } from "@/src/features/share/services/shareService";
import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type LoadState =
    | { status: "loading" }
    | { status: "ready"; share: FetchedShare }
    | { status: "error"; message: string };

export default function ImportScreen() {
    const { token, origin } = useLocalSearchParams<{ token: string; origin?: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [state, setState] = useState<LoadState>({ status: "loading" });

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) setState({ status: "loading" });
        });
        fetchSharedContent(String(token ?? ""), origin)
            .then((share) => {
                if (cancelled) return;
                if (share.kind !== "food" && share.kind !== "recipe" && share.kind !== "log") {
                    setState({ status: "error", message: t("share.importUnsupported") });
                    return;
                }
                setState({ status: "ready", share });
            })
            .catch((e: any) => {
                if (!cancelled) setState({ status: "error", message: e?.message ?? t("common.unknownError") });
            });
        return () => {
            cancelled = true;
        };
    }, [token, origin, t]);

    function close() {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)" as any);
    }

    return (
        <View style={[styles.screen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
            {state.status === "ready" ? (
                <ImportQueueView share={state.share} origin={origin} colors={colors} onClose={close} />
            ) : (
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t("share.import.title")}</Text>
                        <Pressable onPress={close} hitSlop={8}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </Pressable>
                    </View>
                    {state.status === "loading" ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.statusText}>{t("share.importLoading")}</Text>
                        </View>
                    ) : (
                        <View style={styles.center}>
                            <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
                            <Text style={styles.errorText}>{state.message}</Text>
                            <Button title={t("common.cancel")} variant="outline" onPress={close} style={styles.errorBtn} />
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
        },
        header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
        title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
        center: { alignItems: "center", paddingVertical: spacing.xl },
        statusText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md, textAlign: "center" },
        errorText: { fontSize: fontSize.sm, color: colors.danger, marginTop: spacing.md, textAlign: "center" },
        errorBtn: { marginTop: spacing.md },
    });
}
