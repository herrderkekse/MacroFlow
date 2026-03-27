import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { getFoodById, updateFood } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { type FoodUnit, unitLabel, unitsForSystem } from "@/src/utils/units";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { useTranslation } from "react-i18next";

export default function FoodEditorScreen() {
    const { foodId } = useLocalSearchParams<{ foodId: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const unitSystem = useAppStore((s) => s.unitSystem);

    const [name, setName] = useState("");
    const [calories, setCalories] = useState("");
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");
    const [defaultUnit, setDefaultUnit] = useState<FoodUnit>("g");

    useEffect(() => {
        if (!foodId) return;
        const food = getFoodById(Number(foodId));
        if (food) {
            setName(food.name);
            setCalories(String(food.calories_per_100g));
            setProtein(String(food.protein_per_100g));
            setCarbs(String(food.carbs_per_100g));
            setFat(String(food.fat_per_100g));
            setDefaultUnit(food.default_unit as FoodUnit);
        }
    }, [foodId]);

    function handleSave() {
        if (!foodId || !name.trim()) return;
        updateFood(Number(foodId), {
            name: name.trim(),
            calories_per_100g: parseFloat(calories) || 0,
            protein_per_100g: parseFloat(protein) || 0,
            carbs_per_100g: parseFloat(carbs) || 0,
            fat_per_100g: parseFloat(fat) || 0,
            default_unit: defaultUnit,
        });
        logger.info("[DB] Updated food", { id: foodId, name: name.trim() });
        router.back();
    }


    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.flex}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <Input
                    label={t("log.foodName")}
                    placeholder={t("log.foodNamePlaceholder")}
                    value={name}
                    onChangeText={setName}
                    containerStyle={styles.field}
                />

                <Text style={styles.sectionLabel}>{t("log.defaultUnit")}</Text>
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

                <Text style={styles.sectionLabel}>{t("log.nutritionPer100g")}</Text>

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
                    title={t("common.save")}
                    onPress={handleSave}
                    disabled={!name.trim()}
                    style={styles.saveButton}
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg },
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
