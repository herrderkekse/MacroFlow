import IconButton from "@/src/shared/atoms/IconButton";
import SectionCard from "@/src/shared/components/SectionCard";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { WeightLog } from "../services/logDb";
import WeightSheet from "./WeightSheet";

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
    const isImperial = useAppStore((s) => s.unitSystem) === "imperial";
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    function formatWeight(kg: number): string {
        if (isImperial) return (kg * KG_TO_LB).toFixed(1) + " lb";
        return kg.toFixed(1) + " kg";
    }

    return (
        <>
            <SectionCard
                icon="scale-outline"
                title={t("log.weight")}
                onAdd={() => setIsSheetOpen(true)}
                addLabel={t("log.logWeight")}
            >
                {weights.map((w, index) => (
                    <View key={w.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                        <Text style={styles.rowText}>{formatWeight(w.weight_kg)}</Text>
                        <IconButton
                            icon="close"
                            size="sm"
                            color={colors.textTertiary}
                            label={t("common.delete")}
                            onPress={() => onDelete(w.id)}
                        />
                    </View>
                ))}
            </SectionCard>
            <WeightSheet visible={isSheetOpen} onClose={() => setIsSheetOpen(false)} onSave={onAdd} />
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 48,
            marginRight: -spacing.xs,
        },
        rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        rowText: { fontSize: fontSize.md, fontWeight: "500", color: colors.text, fontVariant: ["tabular-nums"] },
    });
}
