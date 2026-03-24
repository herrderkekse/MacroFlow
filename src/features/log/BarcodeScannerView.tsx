import Button from "@/src/components/Button";
import {
    addFood,
    getFoodByBarcode,
    getFoodByOpenfoodfactsId,
    type Food,
} from "@/src/db/queries";
import { getProductByBarcode } from "@/src/services/openfoodfacts";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface BarcodeScannerViewProps {
    visible: boolean;
    onClose: () => void;
    onFoodFound: (food: Food) => void;
    onNotFound: () => void;
}

type ScanState =
    | { status: "scanning" }
    | { status: "loading"; barcode: string }
    | { status: "not-found"; barcode: string }
    | { status: "error"; message: string };

export default function BarcodeScannerView({
    visible,
    onClose,
    onFoodFound,
    onNotFound,
}: BarcodeScannerViewProps) {
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
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

        // 1. Check local DB
        const local = getFoodByBarcode(data);
        if (local) {
            logger.info("[SCAN] Found locally", { id: local.id });
            resetAndClose();
            onFoodFound(local);
            return;
        }

        // 2. Query OpenFoodFacts
        try {
            const product = await getProductByBarcode(data);
            if (!product) {
                setState({ status: "not-found", barcode: data });
                return;
            }

            // Check if we already have this OFF product by its ID
            const existing = getFoodByOpenfoodfactsId(product.code);
            if (existing) {
                resetAndClose();
                onFoodFound(existing);
                return;
            }

            // Create local copy
            const food = addFood({
                name: product.product_name ?? "Unknown",
                calories_per_100g:
                    product.nutriments?.["energy-kcal_100g"] ?? 0,
                protein_per_100g: product.nutriments?.proteins_100g ?? 0,
                carbs_per_100g: product.nutriments?.carbohydrates_100g ?? 0,
                fat_per_100g: product.nutriments?.fat_100g ?? 0,
                barcode: data,
                openfoodfacts_id: product.code,
                source: "openfoodfacts",
            });
            logger.info("[DB] Created food from barcode", {
                id: food.id,
                name: food.name,
            });
            resetAndClose();
            onFoodFound(food);
        } catch {
            setState({
                status: "error",
                message: "Network error — check your connection",
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
                        Camera permission is needed to scan barcodes
                    </Text>
                    <Button
                        title="Grant Permission"
                        onPress={requestPermission}
                        style={{ marginTop: spacing.md }}
                    />
                    <Button
                        title="Cancel"
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
                    <Text style={styles.headerTitle}>Scan Barcode</Text>
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
                                Point camera at a barcode
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
                            Looking up product…
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
                            Product not found for barcode {state.barcode}
                        </Text>
                        <Button
                            title="Scan Again"
                            onPress={handleRetry}
                            style={{ marginTop: spacing.md }}
                        />
                        <Button
                            title="Create Manually"
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
                            title="Scan Again"
                            onPress={handleRetry}
                            style={{ marginTop: spacing.md }}
                        />
                        <Button
                            title="Cancel"
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
