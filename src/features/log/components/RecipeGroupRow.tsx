import { getRecipeItems } from "@/src/features/templates/services/templateDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MealEntryRow from "./MealEntryRow";
import type { EntryWithFood, RecipeGroup } from "./mealSectionContext";
import { useMealSelection } from "./mealSectionContext";

export default function RecipeGroupRow({
    group,
    onEdit,
    onDeleteEntry,
    onEditRecipeGroup,
    onDeleteRecipeLog,
    onConfirmRecipeLog,
    allMealSelected,
}: {
    group: RecipeGroup;
    onEdit?: (row: EntryWithFood) => void;
    onDeleteEntry: (id: number) => void;
    onEditRecipeGroup?: (group: RecipeGroup, currentMultiplier: number) => void;
    onDeleteRecipeLog?: (recipeLogId: number) => void;
    onConfirmRecipeLog?: (recipeLogId: number) => void;
    allMealSelected?: boolean;
}) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const selection = useMealSelection();
    const [expanded, setExpanded] = useState(false);

    const totalCals = group.rows.reduce((sum, row) => {
        const food = row.foods;
        if (!food) return sum;
        return sum + (food.calories_per_100g * row.entries.quantity_grams) / 100;
    }, 0);

    const multiplier = group.portion;

    const isModified = useMemo(() => {
        const templateItems = getRecipeItems(group.recipeId);
        if (templateItems.length !== group.rows.length) return true;
        const templateMap = new Map(
            templateItems.map((t) => [t.recipe_items.food_id, t.recipe_items.quantity_grams]),
        );
        for (const row of group.rows) {
            const templateQty = templateMap.get(row.entries.food_id!);
            if (templateQty === undefined) return true;
            const expected = templateQty * multiplier;
            if (Math.abs(row.entries.quantity_grams - expected) > 0.01) return true;
        }
        return false;
    }, [group.recipeId, group.rows, multiplier]);

    const selectionMode = selection?.selectionMode ?? false;
    const selectedEntryIds = selection?.selectedEntryIds ?? new Set<number>();
    const allGroupSelected = selectionMode && group.rows.length > 0 && group.rows.every(r => selectedEntryIds.has(r.entries.id));

    const displayName = multiplier !== 1
        ? `${multiplier}x ${group.recipeName}`
        : group.recipeName;

    const allGroupEntryIds = group.rows.map(r => r.entries.id);
    const isGroupScheduled = group.rows.length > 0 && group.rows.every(r => r.entries.is_scheduled === 1);

    return (
        <View style={[
            styles.recipeGroup,
            allGroupSelected && !allMealSelected && styles.selectedGroup,
            isGroupScheduled && styles.scheduledEntry,
        ]}>
            <Pressable
                style={styles.recipeHeader}
                onPress={() => {
                    if (selectionMode) {
                        selection?.toggleEntries(allGroupEntryIds);
                    } else {
                        setExpanded(!expanded);
                    }
                }}
                onLongPress={() => {
                    if (selectionMode) {
                        setExpanded(!expanded);
                    } else {
                        selection?.activateSelectionMultiple(allGroupEntryIds);
                    }
                }}
            >
                <Ionicons
                    name={expanded ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={isGroupScheduled ? colors.disabled : colors.textSecondary}
                />
                <Ionicons
                    name={isModified ? "create-outline" : "book-outline"}
                    size={16}
                    color={isGroupScheduled ? colors.disabled : (isModified ? colors.textSecondary : colors.primary)}
                    style={{ marginLeft: 4 }}
                />
                <Text style={[styles.recipeName, isGroupScheduled && styles.scheduledText]} numberOfLines={1}>
                    {displayName}
                </Text>
                <Text style={[styles.recipeDetail, isGroupScheduled && styles.scheduledText]}>
                    {t("common.itemCount", { count: group.rows.length })} · {Math.round(totalCals)} {t("common.cal")}
                </Text>
                {!selectionMode && (
                    <>
                        {isGroupScheduled && onConfirmRecipeLog && (
                            <Pressable
                                onPress={() => onConfirmRecipeLog(group.recipeLogId)}
                                hitSlop={8}
                                style={{ marginRight: spacing.xs }}
                            >
                                <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                            </Pressable>
                        )}
                        {onEditRecipeGroup && (
                            <Pressable
                                onPress={() => onEditRecipeGroup(group, multiplier)}
                                hitSlop={8}
                                style={{ marginRight: spacing.xs }}
                            >
                                <Ionicons name="resize-outline" size={18} color={colors.primary} />
                            </Pressable>
                        )}
                        <Pressable
                            onPress={() => onDeleteRecipeLog?.(group.recipeLogId)}
                            hitSlop={8}
                        >
                            <Ionicons name="close-circle-outline" size={20} color={colors.textTertiary} />
                        </Pressable>
                    </>
                )}
            </Pressable>

            {expanded && (
                <View style={[styles.childContainer, allGroupSelected && styles.selectedChildContainer]}>
                    {group.rows.map((row) => (
                        <MealEntryRow
                            key={row.entries.id}
                            row={row}
                            onEdit={onEdit}
                            onDeleteEntry={onDeleteEntry}
                            isChild
                            allMealSelected={allMealSelected}
                            allGroupSelected={allGroupSelected}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        recipeGroup: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        selectedGroup: {
            borderWidth: 1.5,
            borderTopWidth: 1.5,
            borderColor: colors.primary,
            borderTopColor: colors.primary,
            borderRadius: borderRadius.sm,
            marginVertical: 2,
            paddingHorizontal: spacing.xs,
            zIndex: 1,
        },
        scheduledEntry: {
            opacity: 0.6,
        },
        scheduledText: {
            color: colors.disabled,
        },
        recipeHeader: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm,
            gap: spacing.xs,
        },
        recipeName: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.primary,
        },
        recipeDetail: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginRight: spacing.sm,
        },
        childContainer: {
            borderLeftWidth: 2,
            borderLeftColor: colors.primary + "40",
            marginLeft: spacing.sm,
        },
        selectedChildContainer: {
            borderLeftColor: colors.primary,
        },
    });
}
