import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import MacroLabel from "@/src/components/MacroLabel";
import ModalHeader from "@/src/components/ModalHeader";
import UnitPicker from "@/src/components/UnitPicker";
import { getServingUnits, updateFood, updateRecipeItem, type Food, type RecipeItem, type ServingUnit } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { fromGrams, toGrams, unitLabel, unitsForSystem, type FoodUnit } from "@/src/utils/units";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface RecipeItemModalProps {
    item: RecipeItem | null;
    food: Food | null;
    onClose: () => void;
    onSaved: (itemId: number, quantityGrams: number, unit: string) => void;
}

export default function RecipeItemModal({
    item,
    food,
    onClose,
    onSaved,
}: RecipeItemModalProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const unitSystem = useAppStore((s) => s.unitSystem);

    const [quantity, setQuantity] = useState("100");
    const [unit, setUnit] = useState<FoodUnit>("g");
    const [customServingUnit, setCustomServingUnit] = useState<ServingUnit | null>(null);
    const [foodServingUnits, setFoodServingUnits] = useState<ServingUnit[]>([]);

    React.useEffect(() => {
        if (item && food) {
            const sUnits = food.id ? getServingUnits(food.id) : [];
            setFoodServingUnits(sUnits);
            const matchServing = sUnits.find((s) => s.name === item.quantity_unit);
            if (matchServing) {
                setCustomServingUnit(matchServing);
                setUnit("g");
                setQuantity(String(Math.round((item.quantity_grams / matchServing.grams) * 10) / 10));
            } else {
                setCustomServingUnit(null);
                const itemUnit = (item.quantity_unit ?? "g") as FoodUnit;
                setUnit(itemUnit);
                setQuantity(
                    String(Math.round(fromGrams(item.quantity_grams, itemUnit) * 10) / 10),
                );
            }
        } else if (food) {
            setFoodServingUnits(food.id ? getServingUnits(food.id) : []);
            setCustomServingUnit(null);
        }
    }, [item, food]);

    const qty = parseFloat(quantity) || 0;
    const qtyGrams = customServingUnit ? qty * customServingUnit.grams : toGrams(qty, unit);

    const calculated = useMemo(() => {
        if (!food) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const factor = qtyGrams / 100;
        return {
            calories: food.calories_per_100g * factor,
            protein: food.protein_per_100g * factor,
            carbs: food.carbs_per_100g * factor,
            fat: food.fat_per_100g * factor,
        };
    }, [food, qtyGrams]);

    function handleSave() {
        if (!item || qty <= 0) return;
        const savedUnit = customServingUnit ? customServingUnit.name : unit;
        updateRecipeItem(item.id, { quantity_grams: qtyGrams, quantity_unit: savedUnit });
        if (food?.id) {
            updateFood(food.id, {
                last_logged_amount: qty,
                last_logged_unit: savedUnit,
            });
        }
        onSaved(item.id, qtyGrams, savedUnit);
    }

    const unitOptions = unitsForSystem(unitSystem);

    return (
        <Modal
            visible={!!item}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex}
            >
                {/* Header */}
                <ModalHeader title={t("templates.editIngredient")} onClose={onClose} />

                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Food info */}
                    <Text style={styles.foodName}>{food?.name}</Text>
                    <Text style={styles.per100}>
                        {t("log.per100g", { calories: Math.round(food?.calories_per_100g ?? 0) })}
                    </Text>

                    {/* Quantity */}
                    <Input
                        label={t("log.quantity")}
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="decimal-pad"
                        suffix={customServingUnit ? customServingUnit.name : unitLabel(unit)}
                        containerStyle={styles.quantityInput}
                    />

                    {/* Unit picker */}
                    <Text style={styles.sectionLabel}>{t("log.unit")}</Text>
                    <UnitPicker
                        unitOptions={unitOptions}
                        selectedUnit={unit}
                        onSelectUnit={(u) => { setUnit(u); setCustomServingUnit(null); }}
                        servingUnits={foodServingUnits}
                        selectedServingUnit={customServingUnit}
                        onSelectServingUnit={(su) => setCustomServingUnit(su)}
                        foodId={food?.id ?? null}
                        onServingUnitCreated={(saved, allUnits) => {
                            setFoodServingUnits(allUnits);
                            setCustomServingUnit(saved);
                            setQuantity("1");
                        }}
                    />

                    {/* Live macro calculation */}
                    <View style={styles.calcCard}>
                        <Text style={styles.calcCalories}>
                            {Math.round(calculated.calories)} {t("common.cal")}
                        </Text>
                        <View style={styles.calcMacros}>
                            <MacroLabel
                                label={t("common.protein")}
                                value={calculated.protein}
                                color={colors.protein}
                                textColor={colors.textSecondary}
                            />
                            <MacroLabel
                                label={t("common.carbs")}
                                value={calculated.carbs}
                                color={colors.carbs}
                                textColor={colors.textSecondary}
                            />
                            <MacroLabel
                                label={t("common.fat")}
                                value={calculated.fat}
                                color={colors.fat}
                                textColor={colors.textSecondary}
                            />
                        </View>
                    </View>

                    <Button
                        title={t("common.save")}
                        onPress={handleSave}
                        disabled={qty <= 0}
                        style={styles.saveButton}
                    />
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
        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
        },
        calcCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginTop: spacing.md,
            alignItems: "center",
            gap: spacing.sm,
        },
        calcCalories: {
            fontSize: 28,
            fontWeight: "700",
            color: colors.text,
        },
        calcMacros: {
            flexDirection: "row",
            justifyContent: "space-around",
            width: "100%",
        },
        saveButton: { marginTop: spacing.lg },
    });
}
