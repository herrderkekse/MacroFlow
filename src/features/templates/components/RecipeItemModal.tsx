import Button from "@/src/shared/atoms/Button";
import UnitPicker from "@/src/shared/components/UnitPicker";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { fromGrams, toGrams, unitsForSystem, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import type { DraftIngredient } from "../hooks/useRecipeEditor";
import SlideUpSheet from "./SlideUpSheet";
import { addServingUnit, getServingUnits, type ServingUnit } from "../services/templateDb";

interface RecipeItemModalProps {
    /** The ingredient being edited; null keeps the sheet closed. */
    draft: DraftIngredient | null;
    /** True while the ingredient is being added rather than re-edited. */
    isNew: boolean;
    onClose: () => void;
    onConfirm: (quantityGrams: number, unit: string, servingUnits: ServingUnit[]) => void;
    onRemove: () => void;
}

/**
 * Amount + unit sheet for one ingredient, with its macros updating live.
 * Purely a form: the chosen amount is handed back to the editor and only
 * reaches the database when the recipe itself is saved.
 */
export default function RecipeItemModal({
    draft,
    isNew,
    onClose,
    onConfirm,
    onRemove,
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
        if (!draft) return;
        queueMicrotask(() => {
            setFoodServingUnits(draft.servingUnits);
            const matchServing = draft.servingUnits.find((s) => s.name === draft.quantityUnit);
            if (matchServing) {
                setCustomServingUnit(matchServing);
                setUnit("g");
                setQuantity(String(Math.round((draft.quantityGrams / matchServing.grams) * 10) / 10));
            } else {
                setCustomServingUnit(null);
                const itemUnit = (draft.quantityUnit ?? "g") as FoodUnit;
                setUnit(itemUnit);
                setQuantity(String(Math.round(fromGrams(draft.quantityGrams, itemUnit) * 10) / 10));
            }
        });
    }, [draft]);

    const food = draft?.food ?? null;
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

    // Grams and millilitres move in coarser steps than "1 cup" or "1 patty".
    const step = !customServingUnit && (unit === "g" || unit === "ml") ? 10 : 0.5;

    function bumpQuantity(direction: 1 | -1) {
        const next = Math.max(0, Math.round((qty + direction * step) * 100) / 100);
        setQuantity(String(next));
    }

    /** Keeps the same real amount when the unit changes, e.g. 100 g → 3.5 oz. */
    function convertTo(nextUnit: FoodUnit) {
        setCustomServingUnit(null);
        setUnit(nextUnit);
        setQuantity(String(Math.round(fromGrams(qtyGrams, nextUnit) * 100) / 100));
    }

    function selectServingUnit(su: ServingUnit) {
        setCustomServingUnit(su);
        setQuantity(String(Math.round((qtyGrams / su.grams) * 100) / 100));
    }

    function handleConfirm() {
        if (!draft || qty <= 0) return;
        onConfirm(qtyGrams, customServingUnit ? customServingUnit.name : unit, foodServingUnits);
    }

    const unitOptions = unitsForSystem(unitSystem);

    return (
        <SlideUpSheet visible={!!draft} onClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.titleRow}>
                        <View style={styles.titleMain}>
                            <Text style={styles.foodName}>{food?.name}</Text>
                            <Text style={styles.per100}>
                                {t("log.per100g", { calories: Math.round(food?.calories_per_100g ?? 0) })}
                            </Text>
                        </View>
                        <Pressable onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    <View style={styles.qtyRow}>
                        <Pressable onPress={() => bumpQuantity(-1)} style={styles.qtyBtn}>
                            <Ionicons name="remove" size={20} color={colors.primary} />
                        </Pressable>
                        <TextInput
                            style={styles.qtyInput}
                            value={quantity}
                            onChangeText={(v) => setQuantity(v.replace(/[^0-9.]/g, ""))}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                        />
                        <Pressable onPress={() => bumpQuantity(1)} style={styles.qtyBtn}>
                            <Ionicons name="add" size={20} color={colors.primary} />
                        </Pressable>
                    </View>
                    <UnitPicker
                        unitOptions={unitOptions}
                        selectedUnit={unit}
                        onSelectUnit={convertTo}
                        servingUnits={foodServingUnits}
                        selectedServingUnit={customServingUnit}
                        onSelectServingUnit={selectServingUnit}
                        onAddServingUnit={food?.id ? (name, grams) => addServingUnit({ food_id: food.id, name, grams }) : undefined}
                        onServingUnitCreated={(saved) => {
                            setFoodServingUnits(food?.id ? getServingUnits(food.id) : []);
                            setCustomServingUnit(saved);
                            setQuantity("1");
                        }}
                    />

                    <View style={styles.calcCard}>
                        <Text style={styles.calcLabel}>{t("templates.thisIngredient")}</Text>
                        <View style={styles.calcValues}>
                            <Text style={[styles.calcCal, { color: colors.calories }]}>
                                {Math.round(calculated.calories)} {t("common.cal")}
                            </Text>
                            <Text style={[styles.calcMacro, { color: colors.protein }]}>
                                {Math.round(calculated.protein)} {t("common.g")}
                            </Text>
                            <Text style={[styles.calcMacro, { color: colors.carbs }]}>
                                {Math.round(calculated.carbs)} {t("common.g")}
                            </Text>
                            <Text style={[styles.calcMacro, { color: colors.fat }]}>
                                {Math.round(calculated.fat)} {t("common.g")}
                            </Text>
                        </View>
                    </View>

                    <Button
                        title={isNew ? t("templates.addToRecipe") : t("templates.updateIngredient")}
                        onPress={handleConfirm}
                        disabled={qty <= 0}
                        style={styles.saveButton}
                    />
                    {!isNew && (
                        <Button
                            title={t("templates.removeFromRecipe")}
                            variant="outline"
                            icon={<Ionicons name="trash-outline" size={16} color={colors.danger} />}
                            onPress={onRemove}
                            style={styles.removeButton}
                            textStyle={styles.removeButtonText}
                        />
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SlideUpSheet>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        content: { padding: spacing.md, paddingBottom: spacing.lg },
        titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
        titleMain: { flex: 1 },
        foodName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
        per100: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
        qtyRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.lg,
            marginBottom: spacing.md,
        },
        qtyBtn: {
            width: 46,
            height: 52,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
        },
        qtyInput: {
            flex: 1,
            height: 52,
            borderRadius: borderRadius.md,
            borderWidth: 1.5,
            borderColor: colors.border,
            textAlign: "center",
            fontSize: fontSize.xl,
            fontWeight: "800",
            color: colors.text,
        },
        calcCard: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
            marginTop: spacing.sm,
        },
        calcLabel: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary },
        calcValues: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        calcCal: { fontSize: fontSize.sm, fontWeight: "800" },
        calcMacro: { fontSize: fontSize.xs, fontWeight: "700" },
        saveButton: { marginTop: spacing.md },
        removeButton: { marginTop: spacing.sm, borderColor: colors.danger },
        removeButtonText: { fontSize: fontSize.sm, color: colors.danger },
    });
}
