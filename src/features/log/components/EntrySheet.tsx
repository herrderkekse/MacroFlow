import { addServingUnit, type Food } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import Chip from "@/src/shared/atoms/Chip";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import NutritionSummary from "@/src/shared/components/NutritionSummary";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import Sheet from "@/src/shared/components/Sheet";
import Stepper from "@/src/shared/components/Stepper";
import UnitPicker from "@/src/shared/components/UnitPicker";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { defaultAmountForUnit, unitLabel } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useEntryForm } from "../hooks/useEntryForm";
import type { Entry } from "../services/logDb";

interface EntrySheetProps {
    food: Food | null;
    defaultMealType?: MealType;
    entry?: Entry | null;
    onClose: () => void;
    onSaved: () => void;
    /** Shows a delete action while editing an existing entry. */
    onDelete?: () => void;
}

/**
 * Logs a food, or edits a logged entry: how much, in which unit, for which
 * meal. Open whenever a food has been picked or an entry is tapped.
 */
export default function EntrySheet({
    food,
    defaultMealType,
    entry,
    onClose,
    onSaved,
    onDelete,
}: EntrySheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const form = useEntryForm({ food, defaultMealType, entry, onClose, onSaved });

    const isInvalid = form.qty <= 0;
    const canSchedule = !entry && (!form.selectedGroup || form.selectedGroup.isScheduled);
    const canSaveNow = !!entry || !form.selectedGroup?.isScheduled;

    return (
        <Sheet
            visible={!!food}
            onClose={form.handleClose}
            title={food?.name ?? ""}
            subtitle={t("log.per100g", { calories: Math.round(food?.calories_per_100g ?? 0) })}
            footer={
                <>
                    <View style={styles.footerRow}>
                        {canSchedule && (
                            <Button
                                title={t("log.schedule")}
                                variant="outline"
                                icon={<Ionicons name="calendar-outline" size={17} color={colors.text} />}
                                onPress={() => form.handleSave(1)}
                                disabled={isInvalid}
                                style={styles.footerButton}
                            />
                        )}
                        {canSaveNow && (
                            <Button
                                title={entry ? t("common.save") : t("log.addToLog")}
                                onPress={() => form.handleSave()}
                                disabled={isInvalid}
                                style={styles.footerButton}
                            />
                        )}
                    </View>
                    {entry && onDelete && (
                        <Button title={t("log.deleteEntry")} variant="danger" onPress={onDelete} />
                    )}
                </>
            }
        >
            <FieldLabel style={styles.firstField}>{t("log.quantity")}</FieldLabel>
            <Stepper
                value={form.quantity}
                onChangeText={(text) => { form.markAmountTouched(); form.setQuantity(text); }}
                // Grams and millilitres move in coarser steps than "1 cup" or "1 serving".
                step={!form.customServingUnit && (form.unit === "g" || form.unit === "ml") ? 10 : 0.5}
                suffix={form.customServingUnit ? form.customServingUnit.name : unitLabel(form.unit)}
            />

            <FieldLabel>{t("log.unit")}</FieldLabel>
            <UnitPicker
                unitOptions={form.unitOptions}
                selectedUnit={form.unit}
                onSelectUnit={(u) => {
                    form.setUnit(u);
                    form.setCustomServingUnit(null);
                    if (!form.amountTouched.current) form.setQuantity(String(defaultAmountForUnit(u)));
                }}
                servingUnits={form.foodServingUnits}
                selectedServingUnit={form.customServingUnit}
                onSelectServingUnit={(su) => {
                    if (!form.amountTouched.current) form.setQuantity("1");
                    form.setCustomServingUnit(su);
                }}
                onAddServingUnit={food?.id ? (name, grams) => addServingUnit({ food_id: food.id!, name, grams }) : undefined}
                onServingUnitCreated={form.handleServingUnitCreated}
            />

            <NutritionSummary
                calories={form.calculated.calories}
                protein={form.calculated.protein}
                carbs={form.calculated.carbs}
                fat={form.calculated.fat}
                style={styles.summary}
            />

            <FieldLabel>{t("log.meal")}</FieldLabel>
            <SegmentedControl<MealType>
                options={MEAL_TYPES.map((m) => ({ key: m.key, label: t(`meal.${m.key}`) }))}
                value={form.mealType}
                onChange={form.setMealType}
            />

            {form.recipeGroups.length > 0 && (
                <>
                    <FieldLabel>{t("log.addToRecipe")}</FieldLabel>
                    <View style={styles.chipWrap}>
                        {form.recipeGroups.map((g) => {
                            const isSelected = form.selectedGroup?.recipeLogId === g.recipeLogId;
                            return (
                                <Chip
                                    key={g.recipeLogId}
                                    icon="book-outline"
                                    label={`${g.recipeName}${g.recipeVariant ? ` · ${g.recipeVariant}` : ""}${g.portion !== 1 ? ` (${g.portion}×)` : ""}`}
                                    selected={isSelected}
                                    onPress={() => {
                                        form.setSelectedGroup(isSelected ? null : g);
                                        form.setPortionMode("per-portion");
                                    }}
                                />
                            );
                        })}
                    </View>
                </>
            )}

            {!entry && form.selectedGroup && form.selectedGroup.portion !== 1 && (
                <>
                    <FieldLabel>{t("log.enteredAmountRepresents")}</FieldLabel>
                    <SegmentedControl
                        options={[
                            { key: "per-portion", label: t("log.perPortion") },
                            { key: "total", label: t("log.totalBatch") },
                        ]}
                        value={form.portionMode}
                        onChange={form.setPortionMode}
                    />
                    <Text style={styles.hint}>
                        {form.portionMode === "per-portion"
                            ? t("log.previewAndSavePerPortion", {
                                grams: Math.round(form.finalQtyGrams),
                                unit: t("common.g"),
                                quantity: form.qty,
                                portion: form.selectedGroup.portion,
                            })
                            : t("log.previewAndSaveTotal", {
                                grams: Math.round(form.qtyGrams),
                                unit: t("common.g"),
                            })}
                    </Text>
                </>
            )}
            <View style={styles.bottomSpace} />
        </Sheet>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        firstField: { marginTop: 0 },
        summary: { marginTop: spacing.md },
        chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
        hint: { fontSize: fontSize.xs, lineHeight: 17, color: colors.textSecondary, marginTop: spacing.sm },
        footerRow: { flexDirection: "row", gap: spacing.sm },
        footerButton: { flex: 1 },
        bottomSpace: { height: spacing.md },
    });
}
