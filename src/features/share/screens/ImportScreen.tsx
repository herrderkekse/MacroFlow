// Landing screen for share deep links (macroflow://share/<token>?origin=…).
// Fetches the shared payload, then hands off to the import queue where the user
// walks through each shared item and decides what to do with it. Nothing is
// written to the DB until they confirm on the summary. It is a self-contained
// task, so its header closes (×) rather than going back — a deep link may open
// the app cold with no screen underneath.

import ImportQueueView from "@/src/features/share/components/ImportQueueView";
import type { FetchedShare } from "@/src/features/share/services/shareClient";
import { fetchSharedContent } from "@/src/features/share/services/shareService";
import Button from "@/src/shared/atoms/Button";
import EmptyState from "@/src/shared/atoms/EmptyState";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
        <View style={[styles.screen, { paddingBottom: insets.bottom + spacing.md }]}>
            {state.status === "ready" ? (
                <ImportQueueView share={state.share} origin={origin} colors={colors} onClose={close} />
            ) : (
                <>
                    <ScreenHeader title={t("share.import.title")} backIcon="close" onBack={close} />
                    {state.status === "loading" ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.textSecondary} />
                            <Text style={styles.statusText}>{t("share.importLoading")}</Text>
                        </View>
                    ) : (
                        <EmptyState
                            icon="cloud-offline-outline"
                            title={state.message}
                            action={<Button title={t("common.close")} variant="outline" size="sm" onPress={close} />}
                        />
                    )}
                </>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        center: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md },
        statusText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: "center" },
    });
}
