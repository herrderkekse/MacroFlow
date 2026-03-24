import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { addEntry, formatDateKey, updateEntry, type Entry, type Food } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/types";
import logger from "@/src/utils/logger";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
    const selectedDate = useAppStore((s) => s.selectedDate);
    const unitSystem = useAppStore((s) => s.unitSystem);
    const [quantity, setQuantity] = useState("100");
    const [unit, setUnit] = useState<FoodUnit>("g");
    const [mealType, setMealType] = useState<MealType>(
        defaultMealType ?? "breakfast",
    );

    // initialize when food or entry changes
    React.useEffect(() => {
        if (entry) {
            const entryUnit = (entry.quantity_unit ?? "g") as FoodUnit;
            setUnit(entryUnit);
            setQuantity(String(Math.round(fromGrams(entry.quantity_grams, entryUnit) * 10) / 10));
            setMealType(entry.meal_type as MealType);
        } else if (food) {
            const defaultUnit = (food.default_unit ?? "g") as FoodUnit;
            setUnit(defaultUnit);
            setQuantity(String(food.serving_size ?? 100));
            setMealType(defaultMealType ?? "breakfast");
        } else {
            setQuantity("100");
            setUnit("g");
            setMealType(defaultMealType ?? "breakfast");
        }
    }, [entry, food, defaultMealType]);

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
        if (!food || qty <= 0) return;

        if (entry) {
            updateEntry(entry.id, {
                quantity_grams: qtyGrams,
                quantity_unit: unit,
                meal_type: mealType,
            });
            logger.info("[DB] Updated entry", {
                id: entry.id,
                foodId: food.id,
                quantity: qtyGrams,
                unit,
                mealType: mealType,
            });
        } else {
            addEntry({
                food_id: food.id,
                quantity_grams: qtyGrams,
                quantity_unit: unit,
                timestamp: Date.now(),
                date: formatDateKey(selectedDate),
                meal_type: mealType,
            });
            logger.info("[DB] Added entry", {
                foodId: food.id,
                quantity: qtyGrams,
                unit,
                date: formatDateKey(selectedDate),
                mealType: mealType,
            });
        }

        setQuantity("100");
        onSaved();
    }

    function handleClose() {
        setQuantity("100");
        onClose();
    }

    const unitOptions = unitsForSystem(unitSystem);

    return (
        <Modal
            visible={!!food}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{entry ? "Edit Entry" : "Add to Log"}</Text>
                    <Pressable onPress={handleClose} hitSlop={8}>
                        <Ionicons
                            name="close"
                            size={24}
                            color={colors.textSecondary}
                        />
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Food info */}
                    <Text style={styles.foodName}>{food?.name}</Text>
                    <Text style={styles.per100}>
                        per 100 g: {Math.round(food?.calories_per_100g ?? 0)}{" "}
                        cal
                    </Text>

                    {/* Quantity */}
                    <Input
                        label="Quantity"
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="decimal-pad"
                        suffix={unitLabel(unit)}
                        containerStyle={styles.quantityInput}
                    />

                    {/* Unit picker */}
                    <Text style={styles.sectionLabel}>Unit</Text>
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

                    {/* Live calculation */}
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

                    {/* Meal type picker */}
                    <Text style={styles.sectionLabel}>Meal</Text>
                    <View style={styles.mealRow}>
                        {MEAL_TYPES.map((m) => (
                            <Pressable
                                key={m.key}
                                onPress={() => setMealType(m.key)}
                                style={[
                                    styles.mealChip,
                                    mealType === m.key &&
                                    styles.mealChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.mealChipText,
                                        mealType === m.key &&
                                        styles.mealChipTextActive,
                                    ]}
                                >
                                    {m.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Button
                        title="Save Entry"
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
            <Text style={[macroStyles.macroValue, { color }]}>
                {value.toFixed(1)}g
            </Text>
            <Text style={[macroStyles.macroLabel, { color: textColor }]}>{label}</Text>
        </View>
    );
}

const macroStyles = StyleSheet.create({
    macroItem: { alignItems: "center" },
    macroValue: { fontSize: fontSize.md, fontWeight: "600" },
    macroLabel: { fontSize: fontSize.xs },
});

function createStyles(colors: ThemeColors, insetsTop = 0) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
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
        saveButton: { marginTop: spacing.lg },
    });
}
