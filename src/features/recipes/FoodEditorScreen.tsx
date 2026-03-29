import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { addFood, addServingUnit, deleteServingUnit, getFoodById, getServingUnits, updateFood, updateServingUnit, type ServingUnit, } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { unitLabel, unitsForSystem, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FoodEditorScreen() {
    const { foodId } = useLocalSearchParams<{ foodId?: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const unitSystem = useAppStore((s) => s.unitSystem);

    const [name, setName] = useState("");
    const [calories, setCalories] = useState("");
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");
    const [defaultUnit, setDefaultUnit] = useState<FoodUnit>("g");
    const [servingUnitRows, setServingUnitRows] = useState<
        { id?: number; name: string; grams: string }[]
    >([]);

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
            const units = getServingUnits(Number(foodId));
            setServingUnitRows(
                units.map((u) => ({ id: u.id, name: u.name, grams: String(u.grams) })),
            );
        }
    }, [foodId]);

    function saveServingUnits(targetFoodId: number, existingUnits: ServingUnit[]) {
        const existingIds = new Set(existingUnits.map((u) => u.id));
        const keptIds = new Set<number>();

        for (const row of servingUnitRows) {
            if (!row.name.trim() || !(parseFloat(row.grams) > 0)) continue;
            if (row.id) {
                updateServingUnit(row.id, { name: row.name.trim(), grams: parseFloat(row.grams) });
                keptIds.add(row.id);
            } else {
                addServingUnit({ food_id: targetFoodId, name: row.name.trim(), grams: parseFloat(row.grams) });
            }
        }
        for (const id of existingIds) {
            if (!keptIds.has(id)) deleteServingUnit(id);
        }
    }

    function handleSave() {
        if (!name.trim()) return;
        try {
            if (foodId) {
                const fid = Number(foodId);
                updateFood(fid, {
                    name: name.trim(),
                    calories_per_100g: parseFloat(calories) || 0,
                    protein_per_100g: parseFloat(protein) || 0,
                    carbs_per_100g: parseFloat(carbs) || 0,
                    fat_per_100g: parseFloat(fat) || 0,
                    default_unit: defaultUnit,
                });
                saveServingUnits(fid, getServingUnits(fid));
                logger.info("[DB] Updated food", { id: foodId, name: name.trim() });
            } else {
                const created = addFood({
                    name: name.trim(),
                    calories_per_100g: parseFloat(calories) || 0,
                    protein_per_100g: parseFloat(protein) || 0,
                    carbs_per_100g: parseFloat(carbs) || 0,
                    fat_per_100g: parseFloat(fat) || 0,
                    default_unit: defaultUnit,
                });
                saveServingUnits(created.id, []);
                logger.info("[DB] Created food", { id: created.id, name: name.trim() });
            }
            router.back();
        } catch (e) {
            logger.error("[FoodEditor] Save failed", e);
        }
    }


    return (
        <>
        <Stack.Screen
            options={{
                headerShown: true,
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                headerStatusBarHeight: insets.top,
                title: foodId
                    ? t("recipes.foodEditorTitle")
                    : t("recipes.newFoodTitle"),
            }}
        />
        <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
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

            {/* Serving Units */}
            <Text style={styles.sectionLabel}>{t("recipes.servingUnits")}</Text>
            {servingUnitRows.map((row, idx) => (
                <View key={row.id ?? `new-${idx}`} style={styles.servingRow}>
                    <Input
                        label={t("recipes.servingUnitName")}
                        placeholder={t("recipes.servingUnitNamePlaceholder")}
                        value={row.name}
                        onChangeText={(v) => {
                            const next = [...servingUnitRows];
                            next[idx] = { ...row, name: v };
                            setServingUnitRows(next);
                        }}
                        containerStyle={styles.servingNameField}
                    />
                    <Input
                        label={t("recipes.servingUnitGrams")}
                        placeholder="0"
                        suffix="g"
                        value={row.grams}
                        onChangeText={(v) => {
                            const next = [...servingUnitRows];
                            next[idx] = { ...row, grams: v };
                            setServingUnitRows(next);
                        }}
                        keyboardType="decimal-pad"
                        containerStyle={styles.servingGramsField}
                    />
                    <Pressable
                        onPress={() => setServingUnitRows(servingUnitRows.filter((_, i) => i !== idx))}
                        hitSlop={8}
                        style={styles.servingDeleteBtn}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                </View>
            ))}
            <Pressable
                onPress={() => setServingUnitRows([...servingUnitRows, { name: "", grams: "" }])}
                style={styles.addServingBtn}
            >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addServingText}>{t("recipes.addServingUnit")}</Text>
            </Pressable>

            <Button
                title={t("common.save")}
                onPress={handleSave}
                disabled={!name.trim()}
                style={styles.saveButton}
            />
        </ScrollView>
        </>
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
        servingRow: {
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        servingNameField: { flex: 2 },
        servingGramsField: { flex: 1 },
        servingDeleteBtn: {
            paddingBottom: spacing.sm,
            paddingHorizontal: spacing.xs,
        },
        addServingBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginBottom: spacing.md,
            paddingVertical: spacing.sm,
        },
        addServingText: {
            fontSize: fontSize.sm,
            color: colors.primary,
            fontWeight: "600",
        },
    });
}
