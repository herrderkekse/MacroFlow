import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import ServingUnitEditor, { type ServingUnitRow } from "@/src/components/ServingUnitEditor";
import UnitPicker from "@/src/components/UnitPicker";
import { addFood, addServingUnit, deleteServingUnit, duplicateFood, getFoodById, getServingUnits, softDeleteFood, updateFood, updateServingUnit, type Food, type ServingUnit } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import logger from "@/src/utils/logger";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { unitsForSystem, type FoodUnit } from "@/src/utils/units";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface FoodFormProps {
    /** Existing food ID for edit mode; omit for create mode */
    foodId?: number;
    /** Pre-fill the name field (e.g. from search query) */
    initialName?: string;
    /** Label for the save/create button */
    submitLabel?: string;
    /** Called after successful save with the created/updated food */
    onSaved: (food: Food) => void;
}

export default function FoodForm({ foodId, initialName, submitLabel, onSaved }: FoodFormProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const unitSystem = useAppStore((s) => s.unitSystem);

    const [name, setName] = useState(initialName ?? "");
    const [calories, setCalories] = useState("");
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");
    const [defaultUnit, setDefaultUnit] = useState<FoodUnit>("g");
    const [servingUnitRows, setServingUnitRows] = useState<ServingUnitRow[]>([]);

    useEffect(() => {
        if (!foodId) return;
        const food = getFoodById(foodId);
        if (food) {
            setName(food.name);
            setCalories(String(food.calories_per_100g));
            setProtein(String(food.protein_per_100g));
            setCarbs(String(food.carbs_per_100g));
            setFat(String(food.fat_per_100g));
            setDefaultUnit(food.default_unit as FoodUnit);
            const units = getServingUnits(foodId);
            setServingUnitRows(
                units.map((u) => ({ id: u.id, name: u.name, grams: String(u.grams) })),
            );
        }
    }, [foodId]);

    function saveServingUnits(targetFoodId: number, existingUnits: ServingUnit[]) {
        const existingIds = new Set(existingUnits.map((u) => u.id));
        const keptIds = new Set<number>();

        for (const row of servingUnitRows) {
            if (!row.name.trim() || !(parseFloat(row.grams) > 0)) continue;
            if (row.id) {
                updateServingUnit(row.id, { name: row.name.trim(), grams: parseFloat(row.grams) });
                keptIds.add(row.id);
            } else {
                addServingUnit({ food_id: targetFoodId, name: row.name.trim(), grams: parseFloat(row.grams) });
            }
        }
        for (const id of existingIds) {
            if (!keptIds.has(id)) deleteServingUnit(id);
        }
    }

    function handleSave() {
        if (!name.trim()) return;
        try {
            if (foodId) {
                // Editing an existing food: ask user how to apply the change
                const newValues = {
                    name: name.trim(),
                    calories_per_100g: parseFloat(calories) || 0,
                    protein_per_100g: parseFloat(protein) || 0,
                    carbs_per_100g: parseFloat(carbs) || 0,
                    fat_per_100g: parseFloat(fat) || 0,
                    default_unit: defaultUnit,
                };
                Alert.alert(
                    t("templates.editTitle"),
                    undefined,
                    [
                        { text: t("common.cancel"), style: "cancel" },
                        {
                            text: t("templates.editFutureOnly"),
                            onPress: () => {
                                try {
                                    softDeleteFood(foodId);
                                    const created = duplicateFood(foodId, newValues);
                                    // Apply serving unit edits to the new copy
                                    saveServingUnits(created.id, getServingUnits(created.id));
                                    logger.info("[DB] Duplicated food (future only)", { oldId: foodId, newId: created.id });
                                    onSaved(created);
                                } catch (e) {
                                    logger.error("[FoodForm] Future-only save failed", e);
                                }
                            },
                        },
                        {
                            text: t("templates.editRewriteHistory"),
                            style: "destructive",
                            onPress: () => {
                                try {
                                    updateFood(foodId, newValues);
                                    saveServingUnits(foodId, getServingUnits(foodId));
                                    logger.info("[DB] Updated food (all entries)", { id: foodId, name: name.trim() });
                                    const updated = getFoodById(foodId)!;
                                    onSaved(updated);
                                } catch (e) {
                                    logger.error("[FoodForm] Rewrite-history save failed", e);
                                }
                            },
                        },
                    ],
                );
            } else {
                const created = addFood({
                    name: name.trim(),
                    calories_per_100g: parseFloat(calories) || 0,
                    protein_per_100g: parseFloat(protein) || 0,
                    carbs_per_100g: parseFloat(carbs) || 0,
                    fat_per_100g: parseFloat(fat) || 0,
                    source: "manual",
                    default_unit: defaultUnit,
                });
                saveServingUnits(created.id, []);
                logger.info("[DB] Created food", { id: created.id, name: name.trim() });
                onSaved(created);
            }
        } catch (e) {
            logger.error("[FoodForm] Save failed", e);
        }
    }

    const macroWarning = useMemo(() => {
        const cal = parseFloat(calories);
        const p = parseFloat(protein);
        const c = parseFloat(carbs);
        const f = parseFloat(fat);
        if (!cal || (!p && !c && !f)) return null;
        const expected = p * 4 + c * 4 + f * 9;
        const diff = Math.abs(cal - expected);
        if (diff / Math.max(cal, 1) > 0.2) {
            return t("log.macroWarning", { entered: Math.round(cal), expected: Math.round(expected) });
        }
        return null;
    }, [calories, protein, carbs, fat, t]);

    const unitOptions = unitsForSystem(unitSystem);

    return (
        <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
            <Input
                label={t("log.foodName")}
                placeholder={t("log.foodNamePlaceholder")}
                value={name}
                onChangeText={setName}
                autoFocus={!foodId}
                containerStyle={styles.field}
            />

            <Text style={styles.sectionLabel}>{t("log.defaultUnit")}</Text>
            <UnitPicker
                unitOptions={unitOptions}
                selectedUnit={defaultUnit}
                onSelectUnit={(u) => setDefaultUnit(u)}
                servingUnits={[]}
                selectedServingUnit={null}
                onSelectServingUnit={() => {}}
                foodId={null}
                hideAddButton
            />

            <Text style={styles.sectionLabel}>{t("log.nutritionPer100g")}</Text>

            <View style={styles.row}>
                <Input
                    label={t("settings.calories")}
                    placeholder="0"
                    suffix={t("common.kcal")}
                    value={calories}
                    onChangeText={setCalories}
                    keyboardType="decimal-pad"
                    containerStyle={styles.halfField}
                />
                <Input
                    label={t("settings.protein")}
                    placeholder="0"
                    suffix={t("common.g")}
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="decimal-pad"
                    containerStyle={styles.halfField}
                />
            </View>

            <View style={styles.row}>
                <Input
                    label={t("settings.carbs")}
                    placeholder="0"
                    suffix={t("common.g")}
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="decimal-pad"
                    containerStyle={styles.halfField}
                />
                <Input
                    label={t("settings.fat")}
                    placeholder="0"
                    suffix={t("common.g")}
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="decimal-pad"
                    containerStyle={styles.halfField}
                />
            </View>

            {macroWarning && <Text style={styles.macroWarning}>{macroWarning}</Text>}

            <Text style={styles.sectionLabel}>{t("templates.servingUnits")}</Text>
            <ServingUnitEditor rows={servingUnitRows} onChange={setServingUnitRows} />

            <Button
                title={submitLabel ?? t("common.save")}
                onPress={handleSave}
                disabled={!name.trim()}
                style={styles.saveButton}
            />
        </ScrollView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        content: { padding: spacing.lg },
        field: { marginBottom: spacing.md },
        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            marginBottom: spacing.md,
            marginTop: spacing.sm,
        },
        row: {
            flexDirection: "row",
            gap: spacing.md,
            marginBottom: spacing.md,
        },
        halfField: { flex: 1 },
        macroWarning: {
            fontSize: fontSize.sm,
            color: colors.warning,
            marginBottom: spacing.md,
        },
        saveButton: { marginTop: spacing.md },
    });
}
