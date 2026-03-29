import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { addFood, type Food } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { type FoodUnit, unitLabel, unitsForSystem } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
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
import { useTranslation } from "react-i18next";

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
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
    const unitSystem = useAppStore((s) => s.unitSystem);
    const [name, setName] = useState("");

    useEffect(() => {
        if (visible && initialName) {
            setName(initialName);
        }
    }, [visible, initialName]);
    const [calories, setCalories] = useState("");
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");
    const [defaultUnit, setDefaultUnit] = useState<FoodUnit>("g");

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
            default_unit: defaultUnit,
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
        setDefaultUnit("g");
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
                    <Text style={styles.headerTitle}>{t("log.createNewFood")}</Text>
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
                        label={t("log.foodName")}
                        placeholder={t("log.foodNamePlaceholder")}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        containerStyle={styles.field}
                    />

                    <Text style={styles.sectionLabel}>
                        {t("log.defaultUnit")}
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.unitRow}
                    >
                        {unitsForSystem(unitSystem).map((u) => (
                            <Pressable
                                key={u}
                                onPress={() => setDefaultUnit(u)}
                                style={[
                                    styles.unitChip,
                                    defaultUnit === u && styles.unitChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.unitChipText,
                                        defaultUnit === u && styles.unitChipTextActive,
                                    ]}
                                >
                                    {unitLabel(u)}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <Text style={styles.sectionLabel}>
                        {t("log.nutritionPer100g")}
                    </Text>

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

                    <Button
                        title={t("log.createFood")}
                        onPress={handleSave}
                        disabled={!name.trim()}
                        style={styles.saveButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function createStyles(colors: ThemeColors, insetsTop = 0) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: insetsTop + spacing.md,
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
        unitRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.md,
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
        row: {
            flexDirection: "row",
            gap: spacing.md,
            marginBottom: spacing.md,
        },
        halfField: { flex: 1 },
        saveButton: { marginTop: spacing.md },
    });
}
