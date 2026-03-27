import Input from "@/src/components/Input";
import Button from "@/src/components/Button";
import type { WeightLog } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

const KG_TO_LB = 2.20462;

interface WeightSectionProps {
    weights: WeightLog[];
    onAdd: (weightKg: number) => void;
    onDelete: (id: number) => void;
}

export default function WeightSection({ weights, onAdd, onDelete }: WeightSectionProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const unitSystem = useAppStore((s) => s.unitSystem);
    const isImperial = unitSystem === "imperial";

    const [showModal, setShowModal] = useState(false);
    const [weightInput, setWeightInput] = useState("");

    function handleSave() {
        const value = parseFloat(weightInput);
        if (!value || value <= 0) return;
        const valueKg = isImperial ? value / KG_TO_LB : value;
        onAdd(valueKg);
        setShowModal(false);
        setWeightInput("");
    }

    function formatWeight(kg: number): string {
        if (isImperial) return (kg * KG_TO_LB).toFixed(1) + " lb";
        return kg.toFixed(1) + " kg";
    }

    return (
        <View style={styles.container}>
            <Pressable style={styles.header} onPress={() => setShowModal(true)}>
                <Ionicons name="scale-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.headerLabel}>{t("log.weight")}</Text>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            </Pressable>

            {weights.map((w) => (
                <View key={w.id} style={styles.row}>
                    <Text style={styles.rowText}>{formatWeight(w.weight_kg)}</Text>
                    <Pressable onPress={() => onDelete(w.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                </View>
            ))}

            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
                    <Pressable style={styles.modal} onPress={() => {}}>
                        <Text style={styles.modalTitle}>{t("log.logWeight")}</Text>
                        <Input
                            value={weightInput}
                            onChangeText={setWeightInput}
                            keyboardType="decimal-pad"
                            placeholder={isImperial ? "lb" : "kg"}
                            containerStyle={{ marginBottom: spacing.md }}
                            autoFocus
                        />
                        <Button title={t("common.save")} onPress={handleSave} />
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        headerLabel: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            marginTop: spacing.sm,
        },
        rowText: {
            fontSize: fontSize.sm,
            color: colors.text,
        },
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
        },
        modalTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.md,
        },
    });
}
