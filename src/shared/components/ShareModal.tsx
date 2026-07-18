// Floating modal that turns a "make me a share URL" callback into a QR code
// plus copy / native-share actions. It is deliberately dumb about where the
// URL comes from — the calling screen closes over the right share service
// call — so it can be reused by any feature without importing feature code.

import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

interface ShareModalProps {
    visible: boolean;
    onClose: () => void;
    /** Uploads the shared item and resolves to its share URL. Called each time the modal opens. */
    fetchUrl: () => Promise<string>;
}

type ShareState =
    | { status: "loading" }
    | { status: "ready"; url: string }
    | { status: "error"; message: string };

export default function ShareModal({ visible, onClose, fetchUrl }: ShareModalProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [state, setState] = useState<ShareState>({ status: "loading" });
    const [copied, setCopied] = useState(false);

    // The callback is typically an inline closure; keep the latest one in a
    // ref so the fetch effect only re-runs when the modal opens.
    const fetchUrlRef = useRef(fetchUrl);
    useEffect(() => {
        fetchUrlRef.current = fetchUrl;
    });

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            setState({ status: "loading" });
            setCopied(false);
        });
        fetchUrlRef
            .current()
            .then((url) => {
                if (!cancelled) setState({ status: "ready", url });
            })
            .catch((e: any) => {
                if (!cancelled) {
                    setState({ status: "error", message: e?.message ?? t("common.unknownError") });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [visible, t]);

    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timer);
    }, [copied]);

    async function handleCopy() {
        if (state.status !== "ready") return;
        await Clipboard.setStringAsync(state.url);
        setCopied(true);
    }

    async function handleShare() {
        if (state.status !== "ready") return;
        await Share.share({ message: state.url });
    }

    function handleRetry() {
        setState({ status: "loading" });
        fetchUrlRef
            .current()
            .then((url) => setState({ status: "ready", url }))
            .catch((e: any) =>
                setState({ status: "error", message: e?.message ?? t("common.unknownError") }),
            );
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.modal} onPress={() => {}}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t("share.title")}</Text>
                        <Pressable onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    {state.status === "loading" && (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.statusText}>{t("share.creating")}</Text>
                        </View>
                    )}

                    {state.status === "error" && (
                        <View style={styles.center}>
                            <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
                            <Text style={styles.errorText}>{state.message}</Text>
                            <Button
                                title={t("common.retry")}
                                variant="outline"
                                onPress={handleRetry}
                                style={styles.retryBtn}
                            />
                        </View>
                    )}

                    {state.status === "ready" && (
                        <>
                            {/* Always white so the QR stays scannable in dark mode. */}
                            <View style={styles.qrBox}>
                                <QRCode value={state.url} size={200} backgroundColor="#FFFFFF" color="#000000" />
                            </View>
                            <Text style={styles.hint}>{t("share.hint")}</Text>
                            <Text style={styles.url} numberOfLines={2} selectable>
                                {state.url}
                            </Text>
                            <View style={styles.actionRow}>
                                <Button
                                    title={copied ? t("share.copied") : t("share.copy")}
                                    variant="outline"
                                    icon={
                                        <Ionicons
                                            name={copied ? "checkmark-outline" : "copy-outline"}
                                            size={18}
                                            color={colors.text}
                                        />
                                    }
                                    onPress={handleCopy}
                                    style={styles.actionBtn}
                                />
                                <Button
                                    title={t("share.shareLink")}
                                    icon={<Ionicons name="share-social-outline" size={18} color="#fff" />}
                                    onPress={handleShare}
                                    style={styles.actionBtn}
                                />
                            </View>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        modal: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            width: "100%",
            maxWidth: 340,
            alignItems: "stretch",
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        center: {
            alignItems: "center",
            paddingVertical: spacing.xl,
        },
        statusText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginTop: spacing.md,
            textAlign: "center",
        },
        errorText: {
            fontSize: fontSize.sm,
            color: colors.danger,
            marginTop: spacing.md,
            textAlign: "center",
        },
        retryBtn: { marginTop: spacing.md },
        qrBox: {
            alignSelf: "center",
            backgroundColor: "#FFFFFF",
            borderRadius: borderRadius.md,
            padding: spacing.md,
        },
        hint: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.md,
        },
        url: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            textAlign: "center",
            marginTop: spacing.sm,
        },
        actionRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        actionBtn: { flex: 1 },
    });
}
