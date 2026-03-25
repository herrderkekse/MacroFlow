import Input from "@/src/components/Input";
import Button from "@/src/components/Button";
import { updateRecipeItem, type Food, type RecipeItem } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { fromGrams, toGrams, unitLabel, unitsForSystem, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
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
import { useTranslation } from "react-i18next";

interface RecipeItemModalProps {
    item: RecipeItem | null;
    food: Food | null;
    onClose: () => void;
    onSaved: (itemId: number, quantityGrams: number, unit: FoodUnit) => void;
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

    React.useEffect(() => {
        if (item) {
            const itemUnit = (item.quantity_unit ?? "g") as FoodUnit;
            setUnit(itemUnit);
            setQuantity(
                String(Math.round(fromGrams(item.quantity_grams, itemUnit) * 10) / 10),
            );
        }
    }, [item]);

    const qty = parseFloat(quantity) || 0;
    const qtyGrams = toGrams(qty, unit);

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
        updateRecipeItem(item.id, { quantity_grams: qtyGrams, quantity_unit: unit });
        onSaved(item.id, qtyGrams, unit);
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
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t("recipes.editIngredient")}</Text>
                    <Pressable onPress={onClose} hitSlop={8}>
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </Pressable>
                </View>

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
                        suffix={unitLabel(unit)}
                        containerStyle={styles.quantityInput}
                    />

                    {/* Unit picker */}
                    <Text style={styles.sectionLabel}>{t("log.unit")}</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.unitRow}
                    >
                        {unitOptions.map((u) => (
                            <Pressable
                                key={u}
                                onPress={() => setUnit(u)}
                                style={[
                                    styles.unitChip,
                                    unit === u && styles.unitChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.unitChipText,
                                        unit === u && styles.unitChipTextActive,
                                    ]}
                                >
                                    {unitLabel(u)}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    {/* Live macro calculation */}
                    <View style={styles.calcCard}>
                        <Text style={styles.calcCalories}>
                            {Math.round(calculated.calories)} cal
                        </Text>
                        <View style={styles.calcMacros}>
                            <MacroLabel
                                label="Protein"
                                value={calculated.protein}
                                color={colors.protein}
                                textColor={colors.textSecondary}
                            />
                            <MacroLabel
                                label="Carbs"
                                value={calculated.carbs}
                                color={colors.carbs}
                                textColor={colors.textSecondary}
                            />
                            <MacroLabel
                                label="Fat"
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

function MacroLabel({
    label,
    value,
    color,
    textColor,
}: {
    label: string;
    value: number;
    color: string;
    textColor: string;
}) {
    return (
        <View style={macroStyles.macroItem}>
            <Text style={[macroStyles.macroValue, { color }]}>{value.toFixed(1)}g</Text>
            <Text style={[macroStyles.macroLabel, { color: textColor }]}>{label}</Text>
        </View>
    );
}

const macroStyles = StyleSheet.create({
    macroItem: { alignItems: "center" },
    macroValue: { fontSize: fontSize.md, fontWeight: "600" },
    macroLabel: { fontSize: fontSize.xs },
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        headerTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
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
