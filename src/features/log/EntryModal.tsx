import React, { useState, useMemo } from "react";
import {
    View,
    Text,
    Modal,
    Pressable,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";
import { addEntry, type Food } from "@/src/db/queries";
import { MEAL_TYPES, type MealType } from "@/src/types";
import logger from "@/src/utils/logger";
import Button from "@/src/components/Button";
import Input from "@/src/components/Input";

interface EntryModalProps {
    food: Food | null;
    defaultMealType?: MealType;
    onClose: () => void;
    onSaved: () => void;
}

export default function EntryModal({
    food,
    defaultMealType,
    onClose,
    onSaved,
}: EntryModalProps) {
    const [quantity, setQuantity] = useState("100");
    const [mealType, setMealType] = useState<MealType>(
        defaultMealType ?? "breakfast",
    );

    const qty = parseFloat(quantity) || 0;

    const calculated = useMemo(() => {
        if (!food) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const factor = qty / 100;
        return {
            calories: food.calories_per_100g * factor,
            protein: food.protein_per_100g * factor,
            carbs: food.carbs_per_100g * factor,
            fat: food.fat_per_100g * factor,
        };
    }, [food, qty]);

    function handleSave() {
        if (!food || qty <= 0) return;

        addEntry({
            food_id: food.id,
            quantity_grams: qty,
            timestamp: Date.now(),
            meal_type: mealType,
        });
        logger.info("[DB] Added entry", {
            foodId: food.id,
            quantity: qty,
            mealType,
        });
        setQuantity("100");
        onSaved();
    }

    function handleClose() {
        setQuantity("100");
        onClose();
    }

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
                    <Text style={styles.headerTitle}>Add to Log</Text>
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
                        suffix="g"
                        containerStyle={styles.quantityInput}
                    />

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
                            />
                            <MacroLabel
                                label="Carbs"
                                value={calculated.carbs}
                                color={colors.carbs}
                            />
                            <MacroLabel
                                label="Fat"
                                value={calculated.fat}
                                color={colors.fat}
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
}: {
    label: string;
    value: number;
    color: string;
}) {
    return (
        <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color }]}>
                {value.toFixed(1)}g
            </Text>
            <Text style={styles.macroLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
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
    macroItem: { alignItems: "center" },
    macroValue: { fontSize: fontSize.md, fontWeight: "600" },
    macroLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
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
