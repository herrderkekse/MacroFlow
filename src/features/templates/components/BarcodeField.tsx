import IconButton from "@/src/shared/atoms/IconButton";
import Input from "@/src/shared/atoms/Input";
import BarcodeScannerView from "@/src/shared/components/BarcodeScannerView";
import Disclosure from "@/src/shared/components/Disclosure";
import { borderRadius, controlHeight, spacing } from "@/src/utils/theme";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

interface BarcodeFieldProps {
    value: string;
    onChange: (barcode: string) => void;
}

export default function BarcodeField({ value, onChange }: BarcodeFieldProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(!!value);
    const [showScanner, setShowScanner] = useState(false);

    // Expand once an existing barcode loads in (e.g. after the edited food is fetched).
    const [prevValue, setPrevValue] = useState(value);
    if (value !== prevValue) {
        setPrevValue(value);
        if (value) setExpanded(true);
    }

    return (
        <>
            <Disclosure
                title={t("templates.barcode")}
                icon="barcode-outline"
                open={expanded}
                onToggle={setExpanded}
                style={styles.container}
            >
                <View style={styles.row}>
                    <Input
                        placeholder={t("templates.barcodePlaceholder")}
                        value={value}
                        onChangeText={onChange}
                        keyboardType="number-pad"
                        containerStyle={styles.input}
                    />
                    <IconButton
                        icon="scan-outline"
                        variant="outline"
                        label={t("log.scanBarcode")}
                        onPress={() => setShowScanner(true)}
                        style={styles.scanBtn}
                    />
                </View>
            </Disclosure>
            <BarcodeScannerView<string>
                visible={showScanner}
                onClose={() => setShowScanner(false)}
                onBarcodeScanned={async (barcode) => barcode}
                onFoodFound={onChange}
                onNotFound={() => { }}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: spacing.lg },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    input: { flex: 1 },
    scanBtn: { width: controlHeight.md, height: controlHeight.md, borderRadius: borderRadius.md },
});
