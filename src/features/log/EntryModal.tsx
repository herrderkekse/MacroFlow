import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import MacroLabel from "@/src/components/MacroLabel";
import ModalHeader from "@/src/components/ModalHeader";
import UnitPicker from "@/src/components/UnitPicker";
import { addEntry, formatDateKey, getLoggedRecipeGroups, getServingUnits, updateEntry, updateFood, type Entry, type Food, type LoggedRecipeGroup, type ServingUnit } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/types";
import logger from "@/src/utils/logger";
import { cancelMealReminderIfLogged } from "@/src/services/notifications";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { defaultAmountForUnit, fromGrams, toGrams, unitLabel, unitsForSystem, type FoodUnit } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const selectedDate = useAppStore((s) => s.selectedDate);
    const unitSystem = useAppStore((s) => s.unitSystem);
    const [quantity, setQuantity] = useState("100");
    const [unit, setUnit] = useState<FoodUnit>("g");
    const [customServingUnit, setCustomServingUnit] = useState<ServingUnit | null>(null);
    const [foodServingUnits, setFoodServingUnits] = useState<ServingUnit[]>([]);
    const [mealType, setMealType] = useState<MealType>(
        defaultMealType ?? "breakfast",
    );
    const [recipeGroups, setRecipeGroups] = useState<LoggedRecipeGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<LoggedRecipeGroup | null>(null);
    const [portionMode, setPortionMode] = useState<"per-portion" | "total">("per-portion");
    const amountTouched = useRef(false);

    // Initialize form fields and fetch recipe groups whenever the entry/food/meal/date changes.
    // Keeping this in a single effect avoids a race where a second effect would overwrite
    // the selectedGroup that was just restored from the entry.
    React.useEffect(() => {
        if (!food) {
            setRecipeGroups([]);
            setSelectedGroup(null);
            setFoodServingUnits([]);
            setCustomServingUnit(null);
            amountTouched.current = false;
            return;
        }

        setFoodServingUnits(food.id ? getServingUnits(food.id) : []);

        if (entry) {
            const entryUnit = (entry.quantity_unit ?? "g") as FoodUnit;
            // Check if the entry uses a custom serving unit
            const sUnits = food.id ? getServingUnits(food.id) : [];
            const matchServing = sUnits.find((s) => s.name === entry.quantity_unit);
            if (matchServing) {
                setCustomServingUnit(matchServing);
                setUnit("g");
                setQuantity(String(Math.round((entry.quantity_grams / matchServing.grams) * 10) / 10));
            } else {
                setCustomServingUnit(null);
                setUnit(entryUnit);
                setQuantity(String(Math.round(fromGrams(entry.quantity_grams, entryUnit) * 10) / 10));
            }
            setMealType(entry.meal_type as MealType);
            amountTouched.current = true;

            // Load groups from the entry's own date/meal so the recipe
            // association is always preserved when opening Edit Entry.
            const groups = getLoggedRecipeGroups(entry.date, entry.meal_type);
            setRecipeGroups(groups);
            if (entry.recipe_log_id) {
                const match = groups.find((g) => g.recipeLogId === entry.recipe_log_id);
                setSelectedGroup(match ?? null);
            } else {
                setSelectedGroup(null);
            }
        } else {
            // Use last logged amount/unit if available, otherwise fall back to food defaults
            const sUnits = food.id ? getServingUnits(food.id) : [];
            if (food.last_logged_amount != null && food.last_logged_unit != null) {
                const lastUnit = food.last_logged_unit;
                const matchServing = sUnits.find((s) => s.name === lastUnit);
                if (matchServing) {
                    setCustomServingUnit(matchServing);
                    setUnit("g");
                } else {
                    setCustomServingUnit(null);
                    setUnit(lastUnit as FoodUnit);
                }
                setQuantity(String(food.last_logged_amount));
            } else {
                const defaultUnit = (food.default_unit ?? "g") as FoodUnit;
                setUnit(defaultUnit);
                setCustomServingUnit(null);
                setQuantity(String(food.serving_size ?? 100));
            }
            amountTouched.current = false;
            const meal = defaultMealType ?? (food.last_logged_meal as MealType | null) ?? "breakfast";
            setMealType(meal);

            const dateKey = formatDateKey(selectedDate);
            const groups = getLoggedRecipeGroups(dateKey, meal);
            setRecipeGroups(groups);
            setSelectedGroup(null);
        }
    }, [entry, food, defaultMealType, selectedDate]);

    // Re-fetch recipe groups whenever the user switches the meal picker so the
    // "Add to Recipe" list stays in sync. For edit mode the date comes from the
    // entry itself; for add mode it comes from the store's selectedDate.
    // Clear the selection when the new meal no longer contains the previous group.
    React.useEffect(() => {
        if (!food) return;
        const dateKey = entry ? entry.date : formatDateKey(selectedDate);
        const groups = getLoggedRecipeGroups(dateKey, mealType);
        setRecipeGroups(groups);
        setSelectedGroup((prev) =>
            prev && groups.some((g) => g.recipeLogId === prev.recipeLogId) ? prev : null,
        );
    }, [mealType]); // eslint-disable-line react-hooks/exhaustive-deps

    const qty = parseFloat(quantity) || 0;
    const qtyGrams = customServingUnit ? qty * customServingUnit.grams : toGrams(qty, unit);

    // When adding to a recipe group with a non-1 multiplier and
    // "per-portion" mode, scale the quantity by the group portion.
    const shouldApplyPortion =
        !entry && selectedGroup && selectedGroup.portion !== 1 && portionMode === "per-portion";
    const finalQtyGrams = shouldApplyPortion ? qtyGrams * selectedGroup.portion : qtyGrams;
    const previewQtyGrams = shouldApplyPortion ? finalQtyGrams : qtyGrams;

    const calculated = useMemo(() => {
        if (!food) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const factor = previewQtyGrams / 100;
        return {
            calories: food.calories_per_100g * factor,
            protein: food.protein_per_100g * factor,
            carbs: food.carbs_per_100g * factor,
            fat: food.fat_per_100g * factor,
        };
    }, [food, previewQtyGrams]);

    const savedUnit = customServingUnit ? customServingUnit.name : unit;

    function handleSave() {
        if (!food || qty <= 0) return;

        if (entry) {
            updateEntry(entry.id, {
                quantity_grams: qtyGrams,
                quantity_unit: savedUnit,
                meal_type: mealType,
                recipe_log_id: selectedGroup?.recipeLogId ?? null,
            });
            logger.info("[DB] Updated entry", {
                id: entry.id,
                foodId: food.id,
                quantity: qtyGrams,
                unit: savedUnit,
                mealType: mealType,
                recipeLogId: selectedGroup?.recipeLogId,
            });
        } else {
            addEntry({
                food_id: food.id,
                quantity_grams: finalQtyGrams,
                quantity_unit: savedUnit,
                timestamp: Date.now(),
                date: formatDateKey(selectedDate),
                meal_type: mealType,
                recipe_log_id: selectedGroup?.recipeLogId,
            });
            logger.info("[DB] Added entry", {
                foodId: food.id,
                quantity: finalQtyGrams,
                unit: savedUnit,
                date: formatDateKey(selectedDate),
                mealType: mealType,
                recipeLogId: selectedGroup?.recipeLogId,
            });

            // Persist last logged amount/unit/meal on the food for future defaults
            updateFood(food.id, {
                last_logged_amount: qty,
                last_logged_unit: savedUnit,
                last_logged_meal: mealType,
            });

            // Cancel today's meal reminder since the user just logged food
            cancelMealReminderIfLogged(mealType as MealType);
        }

        setQuantity("100");
        onSaved();
    }

    function handleServingUnitCreated(saved: ServingUnit, allUnits: ServingUnit[]) {
        setFoodServingUnits(allUnits);
        setCustomServingUnit(saved);
        if (!amountTouched.current) setQuantity("1");
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
                <ModalHeader
                    title={entry ? t("log.editEntry") : t("log.addToLog")}
                    onClose={handleClose}
                />

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
                        onChangeText={(text) => { amountTouched.current = true; setQuantity(text); }}
                        keyboardType="decimal-pad"
                        suffix={customServingUnit ? customServingUnit.name : unitLabel(unit)}
                        containerStyle={styles.quantityInput}
                    />

                    {/* Unit picker */}
                    <Text style={styles.sectionLabel}>{t("log.unit")}</Text>
                    <UnitPicker
                        unitOptions={unitOptions}
                        selectedUnit={unit}
                        onSelectUnit={(u) => {
                            setUnit(u);
                            setCustomServingUnit(null);
                            if (!amountTouched.current) setQuantity(String(defaultAmountForUnit(u)));
                        }}
                        servingUnits={foodServingUnits}
                        selectedServingUnit={customServingUnit}
                        onSelectServingUnit={(su) => {
                            if (!amountTouched.current) setQuantity("1");
                            setCustomServingUnit(su);
                        }}
                        foodId={food?.id ?? null}
                        onServingUnitCreated={handleServingUnitCreated}
                    />

                    {/* Live calculation */}
                    <View style={styles.calcCard}>
                        <Text style={styles.calcCalories}>
                            {Math.round(calculated.calories)} {t("common.cal")}
                        </Text>
                        <View style={styles.calcMacros}>
                            <MacroLabel
                                label={t("common.protein")}
                                value={calculated.protein}
                                color={colors.protein}
                                textColor={colors.textSecondary}
                            />
                            <MacroLabel
                                label={t("common.carbs")}
                                value={calculated.carbs}
                                color={colors.carbs}
                                textColor={colors.textSecondary}
                            />
                            <MacroLabel
                                label={t("common.fat")}
                                value={calculated.fat}
                                color={colors.fat}
                                textColor={colors.textSecondary}
                            />
                        </View>
                    </View>

                    {/* Meal type picker */}
                    <Text style={styles.sectionLabel}>{t("log.meal")}</Text>
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
                                    {t(`meal.${m.key}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Recipe group picker */}
                    {recipeGroups.length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>{t("log.addToRecipe")}</Text>
                            {recipeGroups.map((g) => {
                                const isSelected = selectedGroup?.recipeLogId === g.recipeLogId;
                                return (
                                    <Pressable
                                        key={g.recipeLogId}
                                        onPress={() => {
                                            setSelectedGroup(isSelected ? null : g);
                                            setPortionMode("per-portion");
                                        }}
                                        style={[styles.recipeGroupRow, isSelected && styles.recipeGroupRowActive]}
                                    >
                                        <Ionicons
                                            name={isSelected ? "checkmark-circle" : "book-outline"}
                                            size={18}
                                            color={isSelected ? colors.primary : colors.textSecondary}
                                        />
                                        <Text
                                            style={[styles.recipeGroupName, isSelected && styles.recipeGroupNameActive]}
                                            numberOfLines={1}
                                        >
                                            {g.recipeName}{g.portion !== 1 ? ` (${g.portion}x)` : ""}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </>
                    )}

                    {/* Portion mode toggle — shown when adding to a recipe group with multiplier ≠ 1 */}
                    {!entry && selectedGroup && selectedGroup.portion !== 1 && (
                        <>
                            <Text style={styles.sectionLabel}>{t("log.enteredAmountRepresents")}</Text>
                            <View style={styles.mealRow}>
                                <Pressable
                                    onPress={() => setPortionMode("per-portion")}
                                    style={[styles.mealChip, portionMode === "per-portion" && styles.mealChipActive]}
                                >
                                    <Text style={[styles.mealChipText, portionMode === "per-portion" && styles.mealChipTextActive]}>
                                        {t("log.perPortion")}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setPortionMode("total")}
                                    style={[styles.mealChip, portionMode === "total" && styles.mealChipActive]}
                                >
                                    <Text style={[styles.mealChipText, portionMode === "total" && styles.mealChipTextActive]}>
                                        {t("log.totalBatch")}
                                    </Text>
                                </Pressable>
                            </View>
                            <Text style={styles.portionHint}>
                                {portionMode === "per-portion"
                                    ? t("log.previewAndSavePerPortion", {
                                        grams: Math.round(finalQtyGrams),
                                        unit: t("common.g"),
                                        quantity: qty,
                                        portion: selectedGroup.portion,
                                    })
                                    : t("log.previewAndSaveTotal", {
                                        grams: Math.round(qtyGrams),
                                        unit: t("common.g"),
                                    })}
                            </Text>
                        </>
                    )}

                    <Button
                        title={t("log.saveEntry")}
                        onPress={handleSave}
                        disabled={qty <= 0}
                        style={styles.saveButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
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
        recipeGroupRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.xs,
        },
        recipeGroupRowActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primaryLight,
        },
        recipeGroupName: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.text,
        },
        recipeGroupNameActive: {
            fontWeight: "600",
            color: colors.primary,
        },
        portionHint: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginTop: spacing.xs,
        },
        saveButton: { marginTop: spacing.lg },
    });
}
