import SectionCard from "@/src/shared/components/SectionCard";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WeightLog } from "../services/logDb";
import WeightSheet from "./WeightSheet";

const KG_TO_LB = 2.20462;

interface WeightSectionProps {
    weights: WeightLog[];
    /** Left out on the neighbouring days, which are only ever seen mid-swipe. */
    onAdd?: (weightKg: number) => void;
    onDelete?: (id: number) => void;
}

/** The day's weigh-ins, each with its time. Only shown on days that have one. */
export default function WeightSection({ weights, onAdd, onDelete }: WeightSectionProps) {
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const isImperial = useAppStore((s) => s.unitSystem) === "imperial";
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    function formatWeight(kg: number): string {
        if (isImperial) return (kg * KG_TO_LB).toFixed(1) + " lb";
        return kg.toFixed(1) + " kg";
    }

    function formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
    }

    return (
        <>
            <SectionCard
                title={t("log.weight")}
                onAdd={onAdd ? () => setIsSheetOpen(true) : undefined}
                addLabel={t("log.logWeight")}
            >
                {weights.map((w, index) => (
                    <View key={w.id} style={[styles.row, index > 0 && styles.divider]}>
                        <Ionicons name="scale-outline" size={16} color={colors.textTertiary} />
                        <Text style={styles.value}>{formatWeight(w.weight_kg)}</Text>
                        <Text style={styles.time}>{formatTime(w.timestamp)}</Text>
                        {onDelete && (
                            <Pressable
                                onPress={() => onDelete(w.id)}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel={t("common.delete")}
                            >
                                <Ionicons name="close-circle-outline" size={19} color={colors.textTertiary} />
                            </Pressable>
                        )}
                    </View>
                ))}
            </SectionCard>
            {onAdd && <WeightSheet visible={isSheetOpen} onClose={() => setIsSheetOpen(false)} onSave={onAdd} />}
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 2,
            paddingVertical: spacing.sm + 5,
            paddingHorizontal: spacing.md - 2,
        },
        divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        value: { flex: 1, fontSize: fontSize.sm, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
        time: { fontSize: fontSize.xs, color: colors.textTertiary, fontVariant: ["tabular-nums"] },
    });
}
