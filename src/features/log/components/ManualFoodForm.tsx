import { addFood, type Food } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import ModalHeader from "@/src/shared/atoms/ModalHeader";
import UnitPicker from "@/src/shared/components/UnitPicker";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { spacing } from "@/src/utils/theme";
import { unitsForSystem, type FoodUnit } from "@/src/utils/units";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
} from "react-native";

interface ManualFoodFormProps {
    visible: boolean;
    onClose: () => void;
    onFoodCreated: (food: Food) => void;
    initialName?: string;
}

export default function ManualFoodForm({
    visible,
    onClose,
    onFoodCreated,
    initialName,
}: ManualFoodFormProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const unitSystem = useAppStore((s) => s.unitSystem);

    const [name, setName] = useState(initialName ?? "");
    const [calories, setCalories] = useState("");
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");
    const [defaultUnit, setDefaultUnit] = useState<FoodUnit>("g");

    function handleSave() {
        if (!name.trim()) return;
        const food = addFood({
            name: name.trim(),
            calories_per_100g: parseFloat(calories) || 0,
            protein_per_100g: parseFloat(protein) || 0,
            carbs_per_100g: parseFloat(carbs) || 0,
            fat_per_100g: parseFloat(fat) || 0,
            source: "manual",
            default_unit: defaultUnit,
        });
        setName("");
        setCalories("");
        setProtein("");
        setCarbs("");
        setFat("");
        setDefaultUnit("g");
        onFoodCreated(food);
    }

    const unitOptions = unitsForSystem(unitSystem);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={[styles.flex, { backgroundColor: colors.background }]}
            >
                <ModalHeader title={t("log.createNewFood")} onClose={onClose} />
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <Input
                        label={t("log.foodName")}
                        placeholder={t("log.foodNamePlaceholder")}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        containerStyle={styles.field}
                    />
                    <UnitPicker
                        unitOptions={unitOptions}
                        selectedUnit={defaultUnit}
                        onSelectUnit={(u) => setDefaultUnit(u)}
                        servingUnits={[]}
                        selectedServingUnit={null}
                        onSelectServingUnit={() => { }}
                        hideAddButton
                    />
                    <Input
                        label={t("log.nutritionPer100g")}
                        placeholder="0"
                        suffix={t("common.kcal")}
                        value={calories}
                        onChangeText={setCalories}
                        keyboardType="decimal-pad"
                        containerStyle={styles.field}
                    />
                    <Input
                        label={t("settings.protein")}
                        placeholder="0"
                        suffix={t("common.g")}
                        value={protein}
                        onChangeText={setProtein}
                        keyboardType="decimal-pad"
                        containerStyle={styles.field}
                    />
                    <Input
                        label={t("settings.carbs")}
                        placeholder="0"
                        suffix={t("common.g")}
                        value={carbs}
                        onChangeText={setCarbs}
                        keyboardType="decimal-pad"
                        containerStyle={styles.field}
                    />
                    <Input
                        label={t("settings.fat")}
                        placeholder="0"
                        suffix={t("common.g")}
                        value={fat}
                        onChangeText={setFat}
                        keyboardType="decimal-pad"
                        containerStyle={styles.field}
                    />
                    <Button
                        title={t("log.createFood")}
                        onPress={handleSave}
                        disabled={!name.trim()}
                        style={styles.saveBtn}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: spacing.lg },
    field: { marginBottom: spacing.md },
    saveBtn: { marginTop: spacing.md },
});
