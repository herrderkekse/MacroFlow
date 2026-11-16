import Button from "@/src/shared/atoms/Button";
import IconButton from "@/src/shared/atoms/IconButton";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { spacing } from "@/src/utils/theme";
import { servingDisplayUnit, unitLabel, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

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
                            label={idx === 0 ? t("templates.servingUnitName") : undefined}
                            placeholder={t("templates.servingUnitNamePlaceholder")}
                            value={row.name}
                            onChangeText={(v) => updateRow(idx, { name: v })}
                            containerStyle={styles.servingNameField}
                        />
                        <Input
                            label={idx === 0 ? t(amountLabelKey(unit)) : undefined}
                            placeholder="0"
                            suffix={unitLabel(unit)}
                            value={row.grams}
                            onChangeText={(v) => updateRow(idx, { grams: v })}
                            keyboardType="decimal-pad"
                            containerStyle={styles.servingGramsField}
                        />
                        <IconButton
                            icon="close"
                            color={colors.textTertiary}
                            label={t("common.delete")}
                            onPress={() => removeRow(idx)}
                            style={styles.servingDeleteBtn}
                        />
                    </View>
                );
            })}
            <Button
                title={t("templates.addServingUnit")}
                variant="outline"
                size="sm"
                icon={<Ionicons name="add" size={16} color={colors.text} />}
                onPress={addRow}
                style={styles.addServingBtn}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    servingRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginBottom: spacing.sm },
    servingNameField: { flex: 2 },
    servingGramsField: { flex: 1.3 },
    servingDeleteBtn: { marginBottom: 4, marginRight: -spacing.xs },
    addServingBtn: { alignSelf: "flex-start" },
});
