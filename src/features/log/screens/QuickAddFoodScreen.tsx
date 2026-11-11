import { addEntry, deleteEntry, formatDateKey, getEntryById, updateEntry } from "@/src/features/log/services/logDb";
import { addFood, addServingUnit, updateFood } from "@/src/features/templates/services/templateDb";
import { cancelMealReminderIfLogged } from "@/src/services/notifications";
import Button from "@/src/shared/atoms/Button";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import IconButton from "@/src/shared/atoms/IconButton";
import Input from "@/src/shared/atoms/Input";
import Disclosure from "@/src/shared/components/Disclosure";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import logger from "@/src/utils/logger";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

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

    function handleDelete() {
        if (Number.isFinite(numericEntryId)) deleteEntry(numericEntryId);
        logger.info("[QuickAdd] Deleted quick food entry", { entryId });
        router.replace("/(tabs)");
    }

    return (
        <View style={styles.screen}>
            <ScreenHeader
                title={isEditMode ? t("log.quickAddEditTitle") : t("log.quickAddTitle")}
                right={
                    isEditMode ? (
                        <IconButton icon="trash-outline" color={colors.danger} label={t("log.deleteEntry")} onPress={handleDelete} />
                    ) : undefined
                }
            />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.description}>{t("log.quickAddDescription")}</Text>

                <Input
                    label={t("log.quickAddName")}
                    placeholder={t("log.quickAddNamePlaceholder")}
                    value={title}
                    onChangeText={setTitle}
                    autoFocus={!isEditMode}
                    containerStyle={styles.field}
                />

                <Input
                    label={t("log.quickAddCalories")}
                    placeholder="0"
                    suffix={t("common.kcal")}
                    value={calories}
                    onChangeText={setCalories}
                    keyboardType="decimal-pad"
                />

                <FieldLabel>{t("log.meal")}</FieldLabel>
                <SegmentedControl<MealType>
                    options={MEAL_TYPES.map((m) => ({ key: m.key, label: t(`meal.${m.key}`) }))}
                    value={selectedMeal}
                    onChange={setSelectedMeal}
                />

                <Disclosure
                    title={t("log.quickAddToggleMacros")}
                    icon="options-outline"
                    open={showMacros}
                    onToggle={setShowMacros}
                    style={styles.macros}
                >
                    <View style={styles.macroRow}>
                        <Input
                            label={t("settings.protein")}
                            placeholder="0"
                            suffix={t("common.g")}
                            value={protein}
                            onChangeText={setProtein}
                            keyboardType="decimal-pad"
                            containerStyle={styles.macroField}
                        />
                        <Input
                            label={t("settings.carbs")}
                            placeholder="0"
                            suffix={t("common.g")}
                            value={carbs}
                            onChangeText={setCarbs}
                            keyboardType="decimal-pad"
                            containerStyle={styles.macroField}
                        />
                        <Input
                            label={t("settings.fat")}
                            placeholder="0"
                            suffix={t("common.g")}
                            value={fat}
                            onChangeText={setFat}
                            keyboardType="decimal-pad"
                            containerStyle={styles.macroField}
                        />
                    </View>
                </Disclosure>
            </ScrollView>
            <FooterBar>
                <Button
                    title={isEditMode ? t("common.save") : t("log.addToLog")}
                    onPress={handleSave}
                    disabled={isSaveDisabled}
                />
            </FooterBar>
        </View>
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
        screen: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xl },
        description: { fontSize: fontSize.sm, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.md },
        field: { marginBottom: spacing.md },
        macros: { marginTop: spacing.lg },
        macroRow: { flexDirection: "row", gap: spacing.sm },
        macroField: { flex: 1 },
    });
}
