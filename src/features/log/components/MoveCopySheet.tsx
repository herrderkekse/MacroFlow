import Button from "@/src/shared/atoms/Button";
import Chip from "@/src/shared/atoms/Chip";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import type { IconName } from "@/src/shared/atoms/IconButton";
import DateField from "@/src/shared/components/DateField";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { MEAL_TYPES } from "@/src/shared/types";
import { spacing } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { formatDateKey, getLoggedRecipeGroups, type EntryWithFood, type LoggedRecipeGroup } from "../services/logDb";

interface MoveCopySheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (targetDate: Date, targetMealType: string | null, action: "move" | "copy", targetRecipeLogId: number | null) => void;
    initialDate: Date;
    selectedEntries?: EntryWithFood[];
}

/** Moves or copies the selected entries to another day, meal or logged recipe. */
export default function MoveCopySheet({
    visible,
    onClose,
    onConfirm,
    initialDate,
    selectedEntries = [],
}: MoveCopySheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const [targetDate, setTargetDate] = useState(initialDate);
    const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
    const [selectedRecipeLogId, setSelectedRecipeLogId] = useState<number | null>(null);

    // Derive scheduling status of selected entries
    const anyScheduled = selectedEntries.some((e) => e.entries.is_scheduled === 1);
    const anyUnscheduled = selectedEntries.some((e) => e.entries.is_scheduled !== 1);

    // Load recipe groups for the currently selected date+meal
    const recipeGroups: LoggedRecipeGroup[] = useMemo(() => {
        if (!selectedMeal) return [];
        const dateKey = formatDateKey(targetDate);
        return getLoggedRecipeGroups(dateKey, selectedMeal);
    }, [targetDate, selectedMeal]);

    React.useEffect(() => {
        if (visible) {
            queueMicrotask(() => {
                setTargetDate(initialDate);
                setSelectedMeal(null);
                setSelectedRecipeLogId(null);
            });
        }
    }, [visible, initialDate]);

    // Reset recipe selection when meal or date changes
    React.useEffect(() => {
        queueMicrotask(() => setSelectedRecipeLogId(null));
    }, [selectedMeal, targetDate]);

    function isRecipeDisabled(recipe: LoggedRecipeGroup): boolean {
        if (recipe.isScheduled && anyUnscheduled) return true;
        if (!recipe.isScheduled && anyScheduled) return true;
        return false;
    }

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t("log.moveCopyTitle")}
            subtitle={t("log.selectedCount", { count: selectedEntries.length })}
            footer={
                <View style={styles.actions}>
                    <Button
                        title={t("log.copy")}
                        variant="outline"
                        icon={<Ionicons name="copy-outline" size={17} color={colors.text} />}
                        onPress={() => onConfirm(targetDate, selectedMeal, "copy", selectedRecipeLogId)}
                        style={styles.action}
                    />
                    <Button
                        title={t("log.move")}
                        icon={<Ionicons name="arrow-forward" size={17} color={colors.onPrimary} />}
                        onPress={() => onConfirm(targetDate, selectedMeal, "move", selectedRecipeLogId)}
                        style={styles.action}
                    />
                </View>
            }
        >
            <FieldLabel style={styles.firstField}>{t("log.selectDate")}</FieldLabel>
            <DateField value={targetDate} onChange={setTargetDate} />

            <FieldLabel>{t("log.selectMeal")}</FieldLabel>
            <View style={styles.chipWrap}>
                <Chip
                    label={t("log.keepMeal")}
                    icon="swap-horizontal-outline"
                    selected={selectedMeal === null}
                    onPress={() => setSelectedMeal(null)}
                />
                {MEAL_TYPES.map((meal) => (
                    <Chip
                        key={meal.key}
                        label={t(`meal.${meal.key}`)}
                        icon={meal.icon as IconName}
                        selected={selectedMeal === meal.key}
                        onPress={() => setSelectedMeal(meal.key)}
                    />
                ))}
            </View>

            {/* Only a specific meal can hold recipes to move into. */}
            {selectedMeal !== null && recipeGroups.length > 0 && (
                <>
                    <FieldLabel>{t("log.selectRecipe")}</FieldLabel>
                    <View style={styles.chipWrap}>
                        <Chip
                            label={t("log.noRecipe")}
                            selected={selectedRecipeLogId === null}
                            onPress={() => setSelectedRecipeLogId(null)}
                        />
                        {recipeGroups.map((recipe) => {
                            const isSelected = selectedRecipeLogId === recipe.recipeLogId;
                            return (
                                <Chip
                                    key={recipe.recipeLogId}
                                    icon="book-outline"
                                    label={`${recipe.recipeName}${recipe.recipeVariant ? ` · ${recipe.recipeVariant}` : ""}`}
                                    selected={isSelected}
                                    disabled={isRecipeDisabled(recipe)}
                                    onPress={() => setSelectedRecipeLogId(isSelected ? null : recipe.recipeLogId)}
                                />
                            );
                        })}
                    </View>
                </>
            )}
            <View style={styles.bottomSpace} />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    firstField: { marginTop: 0 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    actions: { flexDirection: "row", gap: spacing.sm },
    action: { flex: 1 },
    bottomSpace: { height: spacing.md },
});
