import Button from "@/src/shared/atoms/Button";
import IconButton from "@/src/shared/atoms/IconButton";
import Input from "@/src/shared/atoms/Input";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatQuantity, servingDisplayUnit, unitLabel, type FoodUnit } from "@/src/utils/units";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

export interface ServingUnit {
    id: number;
    name: string;
    grams: number;
    /** Unit the amount is labelled in; null/absent means grams. */
    display_unit?: string | null;
}

interface UnitPickerProps<TUnit extends ServingUnit = ServingUnit> {
    /** Standard unit options to display (e.g. from unitsForSystem) */
    unitOptions: FoodUnit[];
    /** Currently selected standard unit */
    selectedUnit: FoodUnit;
    /** Called when a standard unit chip is pressed */
    onSelectUnit: (unit: FoodUnit) => void;
    /** Custom serving units for the food */
    servingUnits: TUnit[];
    /** Currently selected custom serving unit (null if standard unit is active) */
    selectedServingUnit: TUnit | null;
    /** Called when a custom serving unit chip is pressed */
    onSelectServingUnit: (su: TUnit) => void;
    /** Called with (name, grams) when user saves a new serving unit; must return the saved unit. If omitted, add button is hidden. */
    onAddServingUnit?: (name: string, grams: number) => TUnit;
    /** Called after a new serving unit is created */
    onServingUnitCreated?: (saved: TUnit) => void;
    /** When true, hides the "+" add-unit button entirely */
    hideAddButton?: boolean;
}

export default function UnitPicker<TUnit extends ServingUnit = ServingUnit>({
    unitOptions,
    selectedUnit,
    onSelectUnit,
    servingUnits,
    selectedServingUnit,
    onSelectServingUnit,
    onAddServingUnit,
    onServingUnitCreated,
    hideAddButton,
}: UnitPickerProps<TUnit>) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [showAddUnit, setShowAddUnit] = useState(false);
    const [newUnitName, setNewUnitName] = useState("");
    const [newUnitGrams, setNewUnitGrams] = useState("");

    function handleAddUnit() {
        if (!onAddServingUnit) return;
        const name = newUnitName.trim();
        const grams = parseFloat(newUnitGrams);
        if (!name || !grams || grams <= 0) return;
        const saved = onAddServingUnit(name, grams);
        setNewUnitName("");
        setNewUnitGrams("");
        setShowAddUnit(false);
        onServingUnitCreated?.(saved);
    }

    const canAdd = onAddServingUnit != null && !hideAddButton;

    const isFormValid = !!newUnitName.trim() && parseFloat(newUnitGrams) > 0;

    function closeForm() {
        setShowAddUnit(false);
        setNewUnitName("");
        setNewUnitGrams("");
    }

    return (
        <View>
            <View style={styles.pickerRow}>
                {/* A food's own serving units lead: they are the ones most
                    likely to be picked for that food. */}
                <SegmentedControl<string>
                    options={[
                        ...servingUnits.map((su) => ({
                            key: `su-${su.id}`,
                            label: `${su.name} (${formatQuantity(su.grams, servingDisplayUnit(su.display_unit))})`,
                        })),
                        ...unitOptions.map((u) => ({ key: u, label: unitLabel(u) })),
                    ]}
                    value={selectedServingUnit ? `su-${selectedServingUnit.id}` : selectedUnit}
                    onChange={(key) => {
                        const su = servingUnits.find((s) => `su-${s.id}` === key);
                        if (su) onSelectServingUnit(su);
                        else onSelectUnit(key as FoodUnit);
                    }}
                    style={styles.picker}
                />
                {canAdd && (
                    <IconButton
                        icon={showAddUnit ? "close" : "add"}
                        variant={showAddUnit ? "filled" : "outline"}
                        label={t("templates.newUnit")}
                        onPress={() => (showAddUnit ? closeForm() : setShowAddUnit(true))}
                    />
                )}
            </View>

            {showAddUnit && (
                <View style={styles.addUnitForm}>
                    <View style={styles.addUnitRow}>
                        <Input
                            label={t("templates.servingUnitName")}
                            placeholder={t("templates.servingUnitNamePlaceholder")}
                            value={newUnitName}
                            onChangeText={setNewUnitName}
                            containerStyle={styles.nameField}
                            autoFocus
                        />
                        <Input
                            label={t("templates.servingUnitGrams")}
                            value={newUnitGrams}
                            onChangeText={setNewUnitGrams}
                            keyboardType="decimal-pad"
                            suffix="g"
                            containerStyle={styles.gramsField}
                        />
                    </View>
                    <View style={styles.addUnitActions}>
                        <Button title={t("common.cancel")} variant="ghost" size="sm" onPress={closeForm} />
                        <Button title={t("common.save")} size="sm" onPress={handleAddUnit} disabled={!isFormValid} />
                    </View>
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        pickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        picker: { flex: 1 },
        addUnitForm: {
            marginTop: spacing.sm + 4,
            padding: spacing.sm + 4,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        addUnitRow: { flexDirection: "row", gap: spacing.sm },
        nameField: { flex: 2 },
        gramsField: { flex: 1 },
        addUnitActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm + 4 },
    });
}
