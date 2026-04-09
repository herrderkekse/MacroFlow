import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface BarcodeScannerViewProps<TFood> {
    visible: boolean;
    onClose: () => void;
    /** Resolves to the found food, or null if not found. May throw on network error. */
    onBarcodeScanned: (barcode: string) => Promise<TFood | null>;
    onFoodFound: (food: TFood) => void;
    onNotFound: () => void;
}

type ScanState =
    | { status: "scanning" }
    | { status: "loading"; barcode: string }
    | { status: "not-found"; barcode: string }
    | { status: "error"; message: string };

export default function BarcodeScannerView<TFood>({
    visible,
    onClose,
    onBarcodeScanned,
    onFoodFound,
    onNotFound,
}: BarcodeScannerViewProps<TFood>) {
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [permission, requestPermission] = useCameraPermissions();
    const [state, setState] = useState<ScanState>({ status: "scanning" });

    async function handleBarcodeScanned({
        data,
    }: {
        type: string;
        data: string;
    }) {
        if (state.status !== "scanning") return;
        setState({ status: "loading", barcode: data });

        logger.info("[SCAN] Barcode scanned", { barcode: data });

        try {
            const food = await onBarcodeScanned(data);
            if (!food) {
                setState({ status: "not-found", barcode: data });
                return;
            }
            resetAndClose();
            onFoodFound(food);
        } catch {
            setState({
                status: "error",
                message: t("log.barcodeNetworkError"),
            });
        }
    }

    function resetAndClose() {
        setState({ status: "scanning" });
        onClose();
    }

    function handleRetry() {
        setState({ status: "scanning" });
    }

    function handleCreateManually() {
        resetAndClose();
        onNotFound();
    }

    // ── Permission states ──────────────────────────────────

    if (!permission) {
        return (
            <Modal visible={visible} animationType="slide" onRequestClose={resetAndClose}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </Modal>
        );
    }

    if (!permission.granted) {
        return (
            <Modal visible={visible} animationType="slide" onRequestClose={resetAndClose}>
                <View style={styles.center}>
                    <Ionicons
                        name="camera-outline"
                        size={48}
                        color={colors.textTertiary}
                    />
                    <Text style={styles.permText}>
                        {t("log.barcodePermission")}
                    </Text>
                    <Button
                        title={t("log.barcodeGrantPermission")}
                        onPress={requestPermission}
                        style={{ marginTop: spacing.md }}
                    />
                    <Button
                        title={t("common.cancel")}
                        variant="ghost"
                        onPress={resetAndClose}
                        style={{ marginTop: spacing.sm }}
                    />
                </View>
            </Modal>
        );
    }

    // ── Main camera view ───────────────────────────────────

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={resetAndClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t("log.barcodeTitle")}</Text>
                    <Pressable onPress={resetAndClose} hitSlop={8}>
                        <Ionicons
                            name="close"
                            size={24}
                            color={colors.textSecondary}
                        />
                    </Pressable>
                </View>

                {/* Camera */}
                {state.status === "scanning" && (
                    <CameraView
                        style={styles.camera}
                        barcodeScannerSettings={{
                            barcodeTypes: [
                                "ean13",
                                "ean8",
                                "upc_a",
                                "upc_e",
                            ],
                        }}
                        onBarcodeScanned={handleBarcodeScanned}
                    >
                        <View style={styles.overlay}>
                            <View style={styles.scanFrame} />
                            <Text style={styles.hint}>
                                {t("log.barcodeHint")}
                            </Text>
                        </View>
                    </CameraView>
                )}

                {/* Loading */}
                {state.status === "loading" && (
                    <View style={styles.center}>
                        <ActivityIndicator
                            size="large"
                            color={colors.primary}
                        />
                        <Text style={styles.statusText}>
                            {t("log.barcodeLookingUp")}
                        </Text>
                    </View>
                )}

                {/* Not found */}
                {state.status === "not-found" && (
                    <View style={styles.center}>
                        <Ionicons
                            name="help-circle-outline"
                            size={48}
                            color={colors.textTertiary}
                        />
                        <Text style={styles.statusText}>
                            {t("log.barcodeProductNotFound", { barcode: state.barcode })}
                        </Text>
                        <Button
                            title={t("log.barcodeScanAgain")}
                            onPress={handleRetry}
                            style={{ marginTop: spacing.md }}
                        />
                        <Button
                            title={t("log.barcodeCreateManually")}
                            variant="outline"
                            onPress={handleCreateManually}
                            style={{ marginTop: spacing.sm }}
                        />
                    </View>
                )}

                {/* Error */}
                {state.status === "error" && (
                    <View style={styles.center}>
                        <Ionicons
                            name="cloud-offline-outline"
                            size={48}
                            color={colors.danger}
                        />
                        <Text style={styles.statusText}>{state.message}</Text>
                        <Button
                            title={t("log.barcodeScanAgain")}
                            onPress={handleRetry}
                            style={{ marginTop: spacing.md }}
                        />
                        <Button
                            title={t("common.cancel")}
                            variant="ghost"
                            onPress={resetAndClose}
                            style={{ marginTop: spacing.sm }}
                        />
                    </View>
                )}
            </View>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        headerTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        camera: { flex: 1 },
        overlay: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.3)",
        },
        scanFrame: {
            width: 250,
            height: 150,
            borderWidth: 2,
            borderColor: "#fff",
            borderRadius: borderRadius.md,
        },
        hint: {
            color: "#fff",
            fontSize: fontSize.sm,
            marginTop: spacing.md,
        },
        center: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            backgroundColor: colors.background,
        },
        statusText: {
            fontSize: fontSize.md,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.md,
        },
        permText: {
            fontSize: fontSize.md,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.md,
            paddingHorizontal: spacing.xl,
        },
    });
}
