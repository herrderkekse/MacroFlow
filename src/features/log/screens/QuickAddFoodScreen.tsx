import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { addEntry, formatDateKey, getEntryById, updateEntry } from "@/src/features/log/services/logDb";
import { addFood, addServingUnit, updateFood } from "@/src/features/templates/services/templateDb";
import { cancelMealReminderIfLogged } from "@/src/services/notifications";
import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";

export default function QuickAddFoodScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const selectedDate = useAppStore((s) => s.selectedDate);

    const { mealType, entryId } = useLocalSearchParams<{ mealType?: string; entryId?: string }>();
    const initialMeal = isMealType(mealType) ? mealType : "breakfast";
    const isEditMode = Boolean(entryId);
    const numericEntryId = Number(entryId);

    const [title, setTitle] = React.useState("");
    const [calories, setCalories] = React.useState("");
    const [protein, setProtein] = React.useState("");
    const [carbs, setCarbs] = React.useState("");
    const [fat, setFat] = React.useState("");
    const [selectedMeal, setSelectedMeal] = React.useState<MealType>(initialMeal);
    const [showMacros, setShowMacros] = React.useState(false);

    const isSubmittingRef = React.useRef(false);

    React.useEffect(() => {
        if (!isEditMode || !Number.isFinite(numericEntryId)) return;

        const row = getEntryById(numericEntryId);
        const entry = row?.entries;
        const food = row?.foods;

        if (!entry || !food) {
            logger.warn("[QuickAdd] Edit mode entry not found", { entryId });
            router.replace("/(tabs)");
            return;
        }

        queueMicrotask(() => {
            setTitle(food.name);
            setCalories(String(Math.round(food.calories_per_100g * 10) / 10));
            setProtein(String(Math.round(food.protein_per_100g * 10) / 10));
            setCarbs(String(Math.round(food.carbs_per_100g * 10) / 10));
            setFat(String(Math.round(food.fat_per_100g * 10) / 10));
            setSelectedMeal(isMealType(entry.meal_type) ? entry.meal_type : "breakfast");
            setShowMacros(
                food.protein_per_100g > 0 || food.carbs_per_100g > 0 || food.fat_per_100g > 0,
            );
        });
    }, [entryId, isEditMode, numericEntryId]);

    function handleSave() {
        if (isSubmittingRef.current) return;

        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            Alert.alert(t("settings.invalid"), t("log.quickAddNameRequired"));
            logger.warn("[QuickAdd] Missing title");
            return;
        }

        const caloriesValue = parsePositiveNumber(calories);
        if (caloriesValue <= 0) {
            Alert.alert(t("settings.invalid"), t("log.quickAddCaloriesRequired"));
            logger.warn("[QuickAdd] Invalid calories", { calories });
            return;
        }

        isSubmittingRef.current = true;
        try {
            const proteinValue = parseNonNegativeNumber(protein);
            const carbsValue = parseNonNegativeNumber(carbs);
            const fatValue = parseNonNegativeNumber(fat);

            if (isEditMode) {
                const existing = getEntryById(numericEntryId);
                const existingEntry = existing?.entries;
                const existingFood = existing?.foods;

                if (!existingEntry || !existingFood) {
                    logger.warn("[QuickAdd] Existing quick-add entry missing during save", { entryId });
                    router.replace("/(tabs)");
                    return;
                }

                updateFood(existingFood.id, {
                    name: trimmedTitle,
                    calories_per_100g: caloriesValue,
                    protein_per_100g: proteinValue,
                    carbs_per_100g: carbsValue,
                    fat_per_100g: fatValue,
                    source: "manual",
                    default_unit: "g",
                    serving_size: 100,
                    deleted: 1,
                });

                updateEntry(existingEntry.id, {
                    meal_type: selectedMeal,
                });

                cancelMealReminderIfLogged(selectedMeal, true);

                logger.info("[QuickAdd] Updated quick food entry", {
                    entryId: existingEntry.id,
                    foodId: existingFood.id,
                    meal: selectedMeal,
                });

                router.replace("/(tabs)");
                return;
            }

            // Keep one-time foods out of template search by creating them as soft-deleted.
            const quickFood = addFood({
                name: trimmedTitle,
                calories_per_100g: caloriesValue,
                protein_per_100g: proteinValue,
                carbs_per_100g: carbsValue,
                fat_per_100g: fatValue,
                source: "manual",
                default_unit: "g",
                serving_size: 100,
                deleted: 1,
            });

            addServingUnit({
                food_id: quickFood.id,
                name: "serving",
                grams: 100,
            });

            addEntry({
                food_id: quickFood.id,
                quantity_grams: 100,
                quantity_unit: "serving",
                timestamp: Date.now(),
                date: formatDateKey(selectedDate),
                meal_type: selectedMeal,
                is_scheduled: 0,
            });

            cancelMealReminderIfLogged(selectedMeal, true);

            logger.info("[QuickAdd] Added quick food entry", {
                foodId: quickFood.id,
                meal: selectedMeal,
                date: formatDateKey(selectedDate),
            });

            router.replace("/(tabs)");
        } catch (error) {
            logger.error("[QuickAdd] Failed to create quick add entry", { error });
        } finally {
            isSubmittingRef.current = false;
        }
    }

    const isSaveDisabled = title.trim().length === 0 || parsePositiveNumber(calories) <= 0;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.screen}
        >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.description}>{t("log.quickAddDescription")}</Text>

                <Input
                    label={t("log.quickAddName")}
                    placeholder={t("log.quickAddNamePlaceholder")}
                    value={title}
                    onChangeText={setTitle}
                    autoFocus
                    containerStyle={styles.field}
                />

                <Input
                    label={t("log.quickAddCalories")}
                    placeholder="0"
                    suffix={t("common.kcal")}
                    value={calories}
                    onChangeText={setCalories}
                    keyboardType="decimal-pad"
                    containerStyle={styles.field}
                />

                <Text style={styles.sectionLabel}>{t("log.meal")}</Text>
                <View style={styles.mealRow}>
                    {MEAL_TYPES.map((m) => (
                        <Pressable
                            key={m.key}
                            onPress={() => setSelectedMeal(m.key)}
                            style={[
                                styles.mealChip,
                                selectedMeal === m.key && styles.mealChipActive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.mealChipText,
                                    selectedMeal === m.key && styles.mealChipTextActive,
                                ]}
                            >
                                {t(`meal.${m.key}`)}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Pressable onPress={() => setShowMacros((prev) => !prev)} style={styles.macroToggle}>
                    <View style={styles.macroToggleLeft}>
                        <Ionicons name="options-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.macroToggleText}>{t("log.quickAddToggleMacros")}</Text>
                    </View>
                    <Ionicons
                        name={showMacros ? "chevron-up-outline" : "chevron-down-outline"}
                        size={16}
                        color={colors.textSecondary}
                    />
                </Pressable>

                {showMacros && (
                    <View style={styles.macrosWrap}>
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
                    </View>
                )}

                <Button
                    title={isEditMode ? t("log.quickAddUpdate") : t("log.quickAddSave")}
                    onPress={handleSave}
                    disabled={isSaveDisabled}
                    style={styles.saveButton}
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function parseNonNegativeNumber(value: string): number {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

function parsePositiveNumber(value: string): number {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
}

function isMealType(value?: string): value is MealType {
    return value === "breakfast" || value === "lunch" || value === "dinner" || value === "snack";
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: colors.background,
        },
        content: {
            padding: spacing.lg,
            paddingBottom: spacing.xl,
        },
        description: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        field: {
            marginBottom: spacing.md,
        },
        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            marginBottom: spacing.sm,
        },
        mealRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.md,
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
        mealChipTextActive: {
            color: colors.primary,
        },
        macroToggle: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            marginBottom: spacing.sm,
        },
        macroToggleLeft: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        macroToggleText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            fontWeight: "500",
        },
        macrosWrap: {
            marginTop: spacing.sm,
        },
        saveButton: {
            marginTop: spacing.md,
        },
    });
}
