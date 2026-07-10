import Input from "@/src/shared/atoms/Input";
import BarcodeScannerView from "@/src/shared/components/BarcodeScannerView";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface BarcodeFieldProps {
    value: string;
    onChange: (barcode: string) => void;
}

export default function BarcodeField({ value, onChange }: BarcodeFieldProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [expanded, setExpanded] = useState(!!value);
    const [showScanner, setShowScanner] = useState(false);

    // Expand once an existing barcode loads in (e.g. after the edited food is fetched).
    const [prevValue, setPrevValue] = useState(value);
    if (value !== prevValue) {
        setPrevValue(value);
        if (value) setExpanded(true);
    }

    return (
        <View>
            <Pressable style={styles.header} onPress={() => setExpanded((e) => !e)}>
                <Text style={styles.sectionLabel}>{t("templates.barcode")}</Text>
                <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textTertiary}
                />
            </Pressable>
            {expanded && (
                <View style={styles.row}>
                    <Input
                        placeholder={t("templates.barcodePlaceholder")}
                        value={value}
                        onChangeText={onChange}
                        keyboardType="number-pad"
                        containerStyle={styles.input}
                    />
                    <Pressable
                        onPress={() => setShowScanner(true)}
                        hitSlop={8}
                        style={styles.scanBtn}
                    >
                        <Ionicons name="barcode-outline" size={22} color={colors.primary} />
                    </Pressable>
                </View>
            )}
            <BarcodeScannerView<string>
                visible={showScanner}
                onClose={() => setShowScanner(false)}
                onBarcodeScanned={async (barcode) => barcode}
                onFoodFound={onChange}
                onNotFound={() => { }}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
            marginTop: spacing.sm,
        },
        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        input: { flex: 1 },
        scanBtn: {
            padding: spacing.sm,
        },
    });
}
