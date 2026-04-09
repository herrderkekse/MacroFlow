import { addServingUnit, type Food } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import ModalHeader from "@/src/shared/atoms/ModalHeader";
import MacroLabel from "@/src/shared/components/MacroLabel";
import UnitPicker from "@/src/shared/components/UnitPicker";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { defaultAmountForUnit, unitLabel } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useEntryForm } from "../hooks/useEntryForm";
import type { Entry } from "../services/logDb";

interface EntryModalProps {
    food: Food | null;
    defaultMealType?: MealType;
    entry?: Entry | null;
    onClose: () => void;
    onSaved: () => void;
}

export default function EntryModal({
    food,
    defaultMealType,
    entry,
    onClose,
    onSaved,
}: EntryModalProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const form = useEntryForm({ food, defaultMealType, entry, onClose, onSaved });

    return (
        <Modal
            visible={!!food}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={form.handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex}
            >
                <ModalHeader
                    title={entry ? t("log.editEntry") : t("log.addToLog")}
                    onClose={form.handleClose}
                />

                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.foodName}>{food?.name}</Text>
                    <Text style={styles.per100}>
                        {t("log.per100g", { calories: Math.round(food?.calories_per_100g ?? 0) })}
                    </Text>

                    <Input
                        label={t("log.quantity")}
                        value={form.quantity}
                        onChangeText={(text) => { form.amountTouched.current = true; form.setQuantity(text); }}
                        keyboardType="decimal-pad"
                        suffix={form.customServingUnit ? form.customServingUnit.name : unitLabel(form.unit)}
                        containerStyle={styles.quantityInput}
                    />

                    <Text style={styles.sectionLabel}>{t("log.unit")}</Text>
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

                    <View style={styles.calcCard}>
                        <Text style={styles.calcCalories}>
                            {Math.round(form.calculated.calories)} {t("common.cal")}
                        </Text>
                        <View style={styles.calcMacros}>
                            <MacroLabel
                                label={t("common.protein")}
                                value={form.calculated.protein}
                                color={colors.protein}
                                textColor={colors.textSecondary}
                            />
                            <MacroLabel
                                label={t("common.carbs")}
                                value={form.calculated.carbs}
                                color={colors.carbs}
                                textColor={colors.textSecondary}
                            />
                            <MacroLabel
                                label={t("common.fat")}
                                value={form.calculated.fat}
                                color={colors.fat}
                                textColor={colors.textSecondary}
                            />
                        </View>
                    </View>

                    <Text style={styles.sectionLabel}>{t("log.meal")}</Text>
                    <View style={styles.mealRow}>
                        {MEAL_TYPES.map((m) => (
                            <Pressable
                                key={m.key}
                                onPress={() => form.setMealType(m.key)}
                                style={[
                                    styles.mealChip,
                                    form.mealType === m.key &&
                                    styles.mealChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.mealChipText,
                                        form.mealType === m.key &&
                                        styles.mealChipTextActive,
                                    ]}
                                >
                                    {t(`meal.${m.key}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {form.recipeGroups.length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>{t("log.addToRecipe")}</Text>
                            {form.recipeGroups.map((g) => {
                                const isSelected = form.selectedGroup?.recipeLogId === g.recipeLogId;
                                return (
                                    <Pressable
                                        key={g.recipeLogId}
                                        onPress={() => {
                                            form.setSelectedGroup(isSelected ? null : g);
                                            form.setPortionMode("per-portion");
                                        }}
                                        style={[styles.recipeGroupRow, isSelected && styles.recipeGroupRowActive]}
                                    >
                                        <Ionicons
                                            name={isSelected ? "checkmark-circle" : "book-outline"}
                                            size={18}
                                            color={isSelected ? colors.primary : colors.textSecondary}
                                        />
                                        <Text
                                            style={[styles.recipeGroupName, isSelected && styles.recipeGroupNameActive]}
                                            numberOfLines={1}
                                        >
                                            {g.recipeName}{g.portion !== 1 ? ` (${g.portion}x)` : ""}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </>
                    )}

                    {!entry && form.selectedGroup && form.selectedGroup.portion !== 1 && (
                        <>
                            <Text style={styles.sectionLabel}>{t("log.enteredAmountRepresents")}</Text>
                            <View style={styles.mealRow}>
                                <Pressable
                                    onPress={() => form.setPortionMode("per-portion")}
                                    style={[styles.mealChip, form.portionMode === "per-portion" && styles.mealChipActive]}
                                >
                                    <Text style={[styles.mealChipText, form.portionMode === "per-portion" && styles.mealChipTextActive]}>
                                        {t("log.perPortion")}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => form.setPortionMode("total")}
                                    style={[styles.mealChip, form.portionMode === "total" && styles.mealChipActive]}
                                >
                                    <Text style={[styles.mealChipText, form.portionMode === "total" && styles.mealChipTextActive]}>
                                        {t("log.totalBatch")}
                                    </Text>
                                </Pressable>
                            </View>
                            <Text style={styles.portionHint}>
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

                    {entry ? (
                        <Button
                            title={t("log.saveEntry")}
                            onPress={() => form.handleSave()}
                            disabled={form.qty <= 0}
                            style={styles.saveButton}
                        />
                    ) : form.selectedGroup ? (
                        form.selectedGroup.isScheduled ? (
                            <Button
                                title={t("log.saveEntryAsScheduled")}
                                onPress={() => form.handleSave(1)}
                                disabled={form.qty <= 0}
                                style={styles.saveButton}
                                variant="outline"
                            />
                        ) : (
                            <Button
                                title={t("log.saveEntry")}
                                onPress={() => form.handleSave()}
                                disabled={form.qty <= 0}
                                style={styles.saveButton}
                            />
                        )
                    ) : (
                        <>
                            <Button
                                title={t("log.saveEntry")}
                                onPress={() => form.handleSave()}
                                disabled={form.qty <= 0}
                                style={styles.saveButton}
                            />
                            <Button
                                title={t("log.saveEntryAsScheduled")}
                                onPress={() => form.handleSave(1)}
                                disabled={form.qty <= 0}
                                style={styles.scheduledButton}
                                variant="outline"
                            />
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg },
        foodName: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
        },
        per100: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginTop: spacing.xs,
        },
        quantityInput: { marginTop: spacing.lg },
        calcCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginTop: spacing.md,
            alignItems: "center",
        },
        calcCalories: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.calories,
            marginBottom: spacing.sm,
        },
        calcMacros: {
            flexDirection: "row",
            justifyContent: "space-around",
            width: "100%",
        },
        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
        },
        mealRow: {
            flexDirection: "row",
            gap: spacing.sm,
        },
        mealChip: {
            flex: 1,
            paddingVertical: spacing.sm,
            alignItems: "center",
            borderRadius: borderRadius.sm,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        mealChipActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primaryLight,
        },
        mealChipText: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
        },
        mealChipTextActive: { color: colors.primary },
        recipeGroupRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.xs,
        },
        recipeGroupRowActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primaryLight,
        },
        recipeGroupName: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.text,
        },
        recipeGroupNameActive: {
            fontWeight: "600",
            color: colors.primary,
        },
        portionHint: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginTop: spacing.xs,
        },
        saveButton: { marginTop: spacing.lg },
        scheduledButton: { marginTop: spacing.sm },
    });
}