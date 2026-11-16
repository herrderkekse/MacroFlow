import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import Sheet from "@/src/shared/components/Sheet";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { spacing } from "@/src/utils/theme";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";

const KG_TO_LB = 2.20462;

interface WeightSheetProps {
    visible: boolean;
    onClose: () => void;
    /** Receives the weight in kilograms, whatever unit it was typed in. */
    onSave: (weightKg: number) => void;
}

/** Logs one weigh-in. Opened from the log's "+" menu and the weight section. */
export default function WeightSheet({ visible, onClose, onSave }: WeightSheetProps) {
    const { t } = useTranslation();
    const isImperial = useAppStore((s) => s.unitSystem) === "imperial";
    const [weightInput, setWeightInput] = useState("");
    const value = parseFloat(weightInput.replace(",", "."));
    const isValid = value > 0;

    function handleSave() {
        if (!isValid) return;
        onSave(isImperial ? value / KG_TO_LB : value);
        setWeightInput("");
        onClose();
    }

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t("log.logWeight")}
            footer={<Button title={t("common.save")} onPress={handleSave} disabled={!isValid} />}
        >
            <Input
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                placeholder="0.0"
                suffix={isImperial ? "lb" : "kg"}
                containerStyle={styles.input}
                style={styles.inputText}
                autoFocus
                onSubmitEditing={handleSave}
            />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    input: { marginBottom: spacing.md },
    inputText: { fontSize: 22, fontWeight: "600" },
});
