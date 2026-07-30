import Input from "@/src/shared/atoms/Input";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { servingDisplayUnit, unitLabel, type FoodUnit } from "@/src/utils/units";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export interface ServingUnitRow {
    id?: number;
    name: string;
    grams: string;
    /**
     * The row's `display_unit`: the unit the amount is stated in. The value in
     * `grams` is grams whatever this says (ml is 1:1 with grams), so it only
     * decides the field's label. Absent/null on a hand-added row, which means
     * grams.
     */
    displayUnit?: string | null;
}

interface ServingUnitEditorProps {
    rows: ServingUnitRow[];
    onChange: (rows: ServingUnitRow[]) => void;
}

/**
 * What the amount field is called. The stored number is grams either way, so
 * this names the unit the row is stated in rather than promising a conversion.
 */
function amountLabelKey(unit: FoodUnit): string {
    return unit === "ml" ? "templates.servingUnitMilliliters" : "templates.servingUnitGrams";
}

export default function ServingUnitEditor({ rows, onChange }: ServingUnitEditorProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    function updateRow(idx: number, patch: Partial<ServingUnitRow>) {
        const next = [...rows];
        next[idx] = { ...next[idx], ...patch };
        onChange(next);
    }

    function removeRow(idx: number) {
        onChange(rows.filter((_, i) => i !== idx));
    }

    function addRow() {
        onChange([...rows, { name: "", grams: "" }]);
    }

    return (
        <View>
            {rows.map((row, idx) => {
                const unit = servingDisplayUnit(row.displayUnit);
                return (
                    <View key={row.id ?? `new-${idx}`} style={styles.servingRow}>
                        <Input
                            label={t("templates.servingUnitName")}
                            placeholder={t("templates.servingUnitNamePlaceholder")}
                            value={row.name}
                            onChangeText={(v) => updateRow(idx, { name: v })}
                            containerStyle={styles.servingNameField}
                        />
                        <Input
                            label={t(amountLabelKey(unit))}
                            placeholder="0"
                            suffix={unitLabel(unit)}
                            value={row.grams}
                            onChangeText={(v) => updateRow(idx, { grams: v })}
                            keyboardType="decimal-pad"
                            containerStyle={styles.servingGramsField}
                        />
                        <Pressable
                            onPress={() => removeRow(idx)}
                            hitSlop={8}
                            style={styles.servingDeleteBtn}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.danger} />
                        </Pressable>
                    </View>
                );
            })}
            <Pressable onPress={addRow} style={styles.addServingBtn}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addServingText}>{t("templates.addServingUnit")}</Text>
            </Pressable>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        servingRow: {
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        servingNameField: { flex: 2 },
        servingGramsField: { flex: 1 },
        servingDeleteBtn: {
            paddingBottom: spacing.sm,
            paddingHorizontal: spacing.xs,
        },
        addServingBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginBottom: spacing.md,
            paddingVertical: spacing.sm,
        },
        addServingText: {
            fontSize: fontSize.sm,
            color: colors.primary,
            fontWeight: "600",
        },
    });
}
