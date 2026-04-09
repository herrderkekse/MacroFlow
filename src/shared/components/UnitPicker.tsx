import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { unitLabel, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export interface ServingUnit {
    id: number;
    name: string;
    grams: number;
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

    return (
        <View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.unitRow}
            >
                {unitOptions.map((u) => (
                    <Pressable
                        key={u}
                        onPress={() => onSelectUnit(u)}
                        style={[
                            styles.unitChip,
                            selectedUnit === u && !selectedServingUnit && styles.unitChipActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.unitChipText,
                                selectedUnit === u && !selectedServingUnit && styles.unitChipTextActive,
                            ]}
                        >
                            {unitLabel(u)}
                        </Text>
                    </Pressable>
                ))}
                {servingUnits.map((su) => (
                    <Pressable
                        key={`su-${su.id}`}
                        onPress={() => onSelectServingUnit(su)}
                        style={[
                            styles.unitChip,
                            selectedServingUnit?.id === su.id && styles.unitChipActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.unitChipText,
                                selectedServingUnit?.id === su.id && styles.unitChipTextActive,
                            ]}
                        >
                            {su.name} ({su.grams}g)
                        </Text>
                    </Pressable>
                ))}
                {canAdd && (
                    <Pressable
                        onPress={() => setShowAddUnit((v) => !v)}
                        style={[styles.unitChip, styles.unitChipAdd]}
                    >
                        <Ionicons name="add" size={16} color={colors.primary} />
                    </Pressable>
                )}
            </ScrollView>

            {showAddUnit && (
                <View style={styles.addUnitForm}>
                    <Text style={styles.addUnitTitle}>{t("templates.addServingUnit")}</Text>
                    <View style={styles.addUnitRow}>
                        <TextInput
                            style={[styles.addUnitInput, { flex: 2 }]}
                            placeholder={t("templates.servingUnitNamePlaceholder")}
                            placeholderTextColor={colors.textSecondary}
                            value={newUnitName}
                            onChangeText={setNewUnitName}
                        />
                        <TextInput
                            style={[styles.addUnitInput, { flex: 1 }]}
                            placeholder={t("templates.servingUnitGrams")}
                            placeholderTextColor={colors.textSecondary}
                            value={newUnitGrams}
                            onChangeText={setNewUnitGrams}
                            keyboardType="decimal-pad"
                        />
                    </View>
                    <View style={styles.addUnitActions}>
                        <Pressable
                            onPress={() => { setShowAddUnit(false); setNewUnitName(""); setNewUnitGrams(""); }}
                            style={styles.addUnitCancelBtn}
                        >
                            <Text style={styles.addUnitCancelText}>{t("common.cancel")}</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleAddUnit}
                            style={[styles.addUnitSaveBtn, (!newUnitName.trim() || !parseFloat(newUnitGrams)) && styles.addUnitSaveBtnDisabled]}
                            disabled={!newUnitName.trim() || !parseFloat(newUnitGrams)}
                        >
                            <Text style={styles.addUnitSaveText}>{t("common.save")}</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        unitRow: {
            flexDirection: "row",
            gap: spacing.sm,
            paddingBottom: spacing.sm,
        },
        unitChip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        unitChipActive: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
        },
        unitChipText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        unitChipTextActive: {
            color: colors.primary,
            fontWeight: "600",
        },
        unitChipAdd: {
            borderColor: colors.primary,
            borderStyle: "dashed",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing.sm,
        },
        addUnitForm: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginTop: spacing.sm,
        },
        addUnitTitle: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            marginBottom: spacing.sm,
        },
        addUnitRow: {
            flexDirection: "row",
            gap: spacing.sm,
        },
        addUnitInput: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            fontSize: fontSize.sm,
            color: colors.text,
            backgroundColor: colors.background,
        },
        addUnitActions: {
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: spacing.sm,
            marginTop: spacing.sm,
        },
        addUnitCancelBtn: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.sm,
        },
        addUnitCancelText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        addUnitSaveBtn: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.primary,
        },
        addUnitSaveBtnDisabled: {
            backgroundColor: colors.border,
        },
        addUnitSaveText: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.background,
        },
    });
}
