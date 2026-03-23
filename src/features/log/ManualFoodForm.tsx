import React, { useState } from "react";
import {
    View,
    Text,
    Modal,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";
import { addFood, type Food } from "@/src/db/queries";
import logger from "@/src/utils/logger";
import Button from "@/src/components/Button";
import Input from "@/src/components/Input";

interface ManualFoodFormProps {
    visible: boolean;
    onClose: () => void;
    onFoodCreated: (food: Food) => void;
}

export default function ManualFoodForm({
    visible,
    onClose,
    onFoodCreated,
}: ManualFoodFormProps) {
    const [name, setName] = useState("");
    const [calories, setCalories] = useState("");
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");

    function handleSave() {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        const food = addFood({
            name: trimmedName,
            calories_per_100g: parseFloat(calories) || 0,
            protein_per_100g: parseFloat(protein) || 0,
            carbs_per_100g: parseFloat(carbs) || 0,
            fat_per_100g: parseFloat(fat) || 0,
            source: "manual",
        });
        logger.info("[DB] Created food manually", { id: food.id, name: food.name });
        resetForm();
        onFoodCreated(food);
    }

    function resetForm() {
        setName("");
        setCalories("");
        setProtein("");
        setCarbs("");
        setFat("");
    }

    function handleClose() {
        resetForm();
        onClose();
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Create New Food</Text>
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
                    <Input
                        label="Food Name"
                        placeholder="e.g., Chicken Breast"
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        containerStyle={styles.field}
                    />

                    <Text style={styles.sectionLabel}>
                        Nutrition per 100 g
                    </Text>

                    <View style={styles.row}>
                        <Input
                            label="Calories"
                            placeholder="0"
                            suffix="kcal"
                            value={calories}
                            onChangeText={setCalories}
                            keyboardType="decimal-pad"
                            containerStyle={styles.halfField}
                        />
                        <Input
                            label="Protein"
                            placeholder="0"
                            suffix="g"
                            value={protein}
                            onChangeText={setProtein}
                            keyboardType="decimal-pad"
                            containerStyle={styles.halfField}
                        />
                    </View>

                    <View style={styles.row}>
                        <Input
                            label="Carbs"
                            placeholder="0"
                            suffix="g"
                            value={carbs}
                            onChangeText={setCarbs}
                            keyboardType="decimal-pad"
                            containerStyle={styles.halfField}
                        />
                        <Input
                            label="Fat"
                            placeholder="0"
                            suffix="g"
                            value={fat}
                            onChangeText={setFat}
                            keyboardType="decimal-pad"
                            containerStyle={styles.halfField}
                        />
                    </View>

                    <Button
                        title="Create Food"
                        onPress={handleSave}
                        disabled={!name.trim()}
                        style={styles.saveButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
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
    content: {
        padding: spacing.lg,
    },
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
    saveButton: { marginTop: spacing.md },
});
