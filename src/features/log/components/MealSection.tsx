import { getRecipeById } from "@/src/features/templates/services/templateDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import type { MealType } from "@/src/shared/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getRecipeLogById } from "../services/logDb";
import MealEntryRow from "./MealEntryRow";
import type { EntryWithFood, MealSelectionContextValue, RecipeGroup } from "./mealSectionContext";
import { MealSelectionContext } from "./mealSectionContext";
import RecipeGroupRow from "./RecipeGroupRow";

export type { RecipeGroup } from "./mealSectionContext";

interface MealSectionProps {
    mealType: MealType;
    icon: string;
    items: EntryWithFood[];
    onAdd: () => void;
    onDeleteEntry: (id: number) => void;
    onEdit?: (row: EntryWithFood) => void;
    onEditRecipeGroup?: (group: RecipeGroup, currentMultiplier: number) => void;
    onDeleteRecipeLog?: (recipeLogId: number) => void;
    onConfirmEntry?: (id: number) => void;
    onConfirmRecipeLog?: (recipeLogId: number) => void;
    selectionMode?: boolean;
    selectedEntryIds?: Set<number>;
    onToggleEntries?: (entryIds: number[]) => void;
    onActivateSelection?: (entryId: number) => void;
    onActivateSelectionMultiple?: (entryIds: number[]) => void;
}

function groupEntries(items: EntryWithFood[]) {
    const standalone: EntryWithFood[] = [];
    const recipeMap = new Map<number, EntryWithFood[]>();

    for (const item of items) {
        const rlId = item.entries.recipe_log_id;
        if (rlId) {
            const list = recipeMap.get(rlId) ?? [];
            list.push(item);
            recipeMap.set(rlId, list);
        } else {
            standalone.push(item);
        }
    }

    const recipeGroups: RecipeGroup[] = [];
    for (const [recipeLogId, rows] of recipeMap) {
        const recipeLog = getRecipeLogById(recipeLogId);
        if (!recipeLog) {
            standalone.push(...rows);
            continue;
        }
        const recipe = getRecipeById(recipeLog.recipe_id);
        recipeGroups.push({
            recipeLogId,
            recipeId: recipeLog.recipe_id,
            recipeName: recipe?.name ?? "Recipe",
            portion: recipeLog.portion,
            rows,
        });
    }

    return { standalone, recipeGroups };
}

export default function MealSection({
    mealType,
    icon,
    items,
    onAdd,
    onDeleteEntry,
    onEdit,
    onEditRecipeGroup,
    onDeleteRecipeLog,
    onConfirmEntry,
    onConfirmRecipeLog,
    selectionMode,
    selectedEntryIds,
    onToggleEntries,
    onActivateSelection,
    onActivateSelectionMultiple,
}: MealSectionProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const totalCals = items.reduce((sum, row) => {
        const cals = row.foods?.calories_per_100g ?? 0;
        const qty = row.entries.quantity_grams;
        return sum + (cals * qty) / 100;
    }, 0);

    const totalProtein = items.reduce((sum, row) => {
        const p = row.foods?.protein_per_100g ?? 0;
        return sum + (p * row.entries.quantity_grams) / 100;
    }, 0);

    const totalCarbs = items.reduce((sum, row) => {
        const c = row.foods?.carbs_per_100g ?? 0;
        return sum + (c * row.entries.quantity_grams) / 100;
    }, 0);

    const totalFat = items.reduce((sum, row) => {
        const f = row.foods?.fat_per_100g ?? 0;
        return sum + (f * row.entries.quantity_grams) / 100;
    }, 0);

    const { standalone, recipeGroups } = groupEntries(items);
    const allMealEntryIds = items.map(e => e.entries.id);
    const allMealSelected = selectionMode && items.length > 0 && items.every(e => selectedEntryIds?.has(e.entries.id));
    const selectionContextValue: MealSelectionContextValue = {
        selectionMode: selectionMode ?? false,
        selectedEntryIds: selectedEntryIds ?? new Set<number>(),
        toggleEntries: (entryIds) => onToggleEntries?.(entryIds),
        activateSelection: (entryId) => onActivateSelection?.(entryId),
        activateSelectionMultiple: (entryIds) => onActivateSelectionMultiple?.(entryIds),
    };

    return (
        <MealSelectionContext.Provider value={selectionContextValue}>
            <View style={[styles.container, allMealSelected && styles.selectedMeal]}>
                <Pressable
                    style={styles.header}
                    onPress={() => {
                        if (selectionMode && items.length > 0) {
                            onToggleEntries?.(allMealEntryIds);
                        } else if (!selectionMode) {
                            onAdd();
                        }
                    }}
                    onLongPress={() => {
                        if (selectionMode && items.length > 0) {
                            onToggleEntries?.(allMealEntryIds);
                        } else if (!selectionMode && items.length > 0) {
                            onActivateSelectionMultiple?.(allMealEntryIds);
                        }
                    }}
                >
                    <View style={styles.headerLeft}>
                        <Ionicons name={icon as never} size={18} color={colors.textSecondary} />
                        <Text style={styles.title}>{t(`meal.${mealType}`)}</Text>

                        {items.length > 0 && (
                            <View style={styles.pillsContainer}>
                                <View style={styles.pill}>
                                    <Text style={[styles.pillText, { color: colors.textSecondary }]}>
                                        <Text style={{ color: colors.calories }}>{Math.round(totalCals)} {t("common.cal")}</Text>
                                        <Text style={{ color: colors.textSecondary }}> - </Text>
                                        <Text style={{ color: colors.protein }}>{Math.round(totalProtein)}g</Text>
                                        <Text style={{ color: colors.textSecondary }}> | </Text>
                                        <Text style={{ color: colors.carbs }}>{Math.round(totalCarbs)}g</Text>
                                        <Text style={{ color: colors.textSecondary }}> | </Text>
                                        <Text style={{ color: colors.fat }}>{Math.round(totalFat)}g</Text>
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                    {!selectionMode && (
                        <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                    )}
                </Pressable>

                {items.length === 0 ? (
                    <Pressable onPress={() => !selectionMode && onAdd()} style={styles.emptyPressable}>
                        <Text style={styles.empty}>{t("log.noFoodsLogged")}</Text>
                    </Pressable>
                ) : (
                    <>
                        {recipeGroups.map((rg) => (
                            <RecipeGroupRow
                                key={rg.recipeLogId}
                                group={rg}
                                onEdit={onEdit}
                                onDeleteEntry={onDeleteEntry}
                                onEditRecipeGroup={onEditRecipeGroup}
                                onDeleteRecipeLog={onDeleteRecipeLog}
                                onConfirmRecipeLog={onConfirmRecipeLog}
                                allMealSelected={allMealSelected}
                            />
                        ))}

                        {standalone.map((row) => (
                            <MealEntryRow
                                key={row.entries.id}
                                row={row}
                                onEdit={onEdit}
                                onDeleteEntry={onDeleteEntry}
                                onConfirmEntry={onConfirmEntry}
                                allMealSelected={allMealSelected}
                            />
                        ))}
                    </>
                )}
            </View>
        </MealSelectionContext.Provider>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
        },
        headerLeft: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        title: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
        },
        pillsContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginLeft: spacing.xs,
        },
        pill: {
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            minHeight: 20,
            justifyContent: "center",
            alignItems: "center",
        },
        pillText: {
            fontSize: fontSize.xs,
            color: "#ffffff",
            fontWeight: "600",
        },
        empty: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
            fontStyle: "italic",
            paddingVertical: spacing.xs,
        },
        emptyPressable: {
            alignSelf: "stretch",
            marginTop: -spacing.sm,
            paddingTop: spacing.sm,
        },
        selectedMeal: {
            borderWidth: 1.5,
            borderColor: colors.primary,
        },
    });
}