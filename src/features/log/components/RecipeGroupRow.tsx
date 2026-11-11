import { getRecipeItems } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MealEntryRow from "./MealEntryRow";
import type { EntryWithFood, RecipeGroup } from "./mealSectionContext";
import { useMealSelection } from "./mealSectionContext";

interface RecipeGroupRowProps {
    group: RecipeGroup;
    onEdit?: (row: EntryWithFood) => void;
    onEditRecipeGroup?: (group: RecipeGroup, currentMultiplier: number) => void;
    onDeleteRecipeLog?: (recipeLogId: number) => void;
    onConfirmRecipeLog?: (recipeLogId: number) => void;
    isFirst?: boolean;
}

/**
 * A logged recipe: one row that expands into its ingredients. The less
 * common actions (adjust portions, delete) only appear once it is expanded.
 */
export default function RecipeGroupRow({
    group,
    onEdit,
    onEditRecipeGroup,
    onDeleteRecipeLog,
    onConfirmRecipeLog,
    isFirst = false,
}: RecipeGroupRowProps) {
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
        ? `${multiplier}× ${group.recipeName}`
        : group.recipeName;

    const allGroupEntryIds = group.rows.map(r => r.entries.id);
    const isGroupScheduled = group.rows.length > 0 && group.rows.every(r => r.entries.is_scheduled === 1);

    const canConfirm = isGroupScheduled && !!onConfirmRecipeLog && !selectionMode;
    const detail = [
        group.recipeVariant,
        t("common.itemCount", { count: group.rows.length }),
        isModified ? t("log.recipeModified") : null,
        isGroupScheduled ? t("log.planned") : null,
    ].filter(Boolean).join(" · ");

    return (
        <View style={!isFirst && styles.divider}>
            <Pressable
                style={({ pressed }) => [styles.header, pressed && styles.pressed]}
                onPress={() => {
                    if (selectionMode) selection?.toggleEntries(allGroupEntryIds);
                    else setExpanded(!expanded);
                }}
                onLongPress={() => {
                    if (selectionMode) setExpanded(!expanded);
                    else selection?.activateSelectionMultiple(allGroupEntryIds);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded, selected: selectionMode ? allGroupSelected : undefined }}
            >
                {selectionMode && (
                    <Ionicons
                        name={allGroupSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={allGroupSelected ? colors.primary : colors.textTertiary}
                    />
                )}
                {canConfirm && (
                    <Pressable
                        onPress={() => onConfirmRecipeLog(group.recipeLogId)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t("log.confirmEaten")}
                    >
                        <Ionicons name="ellipse-outline" size={22} color={colors.textSecondary} />
                    </Pressable>
                )}
                <View style={styles.info}>
                    <View style={styles.nameRow}>
                        <Ionicons
                            name="book-outline"
                            size={14}
                            color={isGroupScheduled ? colors.textTertiary : colors.textSecondary}
                        />
                        <Text style={[styles.name, isGroupScheduled && styles.planned]} numberOfLines={1}>
                            {displayName}
                        </Text>
                        <Ionicons
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={14}
                            color={colors.textTertiary}
                        />
                    </View>
                    <Text style={[styles.detail, isGroupScheduled && styles.planned]} numberOfLines={1}>
                        {detail}
                    </Text>
                </View>
                <Text style={[styles.calories, isGroupScheduled && styles.planned]}>{Math.round(totalCals)}</Text>
            </Pressable>

            {expanded && (
                <View style={styles.children}>
                    {group.rows.map((row) => (
                        <MealEntryRow key={row.entries.id} row={row} onEdit={onEdit} isChild />
                    ))}
                    {!selectionMode && (
                        <View style={styles.actions}>
                            {onEditRecipeGroup && (
                                <Button
                                    title={t("log.adjustPortions")}
                                    variant="outline"
                                    size="sm"
                                    icon={<Ionicons name="resize-outline" size={15} color={colors.text} />}
                                    onPress={() => onEditRecipeGroup(group, multiplier)}
                                />
                            )}
                            <Button
                                title={t("common.delete")}
                                variant="danger"
                                size="sm"
                                icon={<Ionicons name="trash-outline" size={15} color={colors.danger} />}
                                onPress={() => onDeleteRecipeLog?.(group.recipeLogId)}
                            />
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 2,
            minHeight: 52,
            paddingVertical: spacing.sm,
        },
        pressed: { opacity: 0.6 },
        info: { flex: 1 },
        nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        name: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        detail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
        planned: { color: colors.textTertiary },
        calories: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
            minWidth: 36,
            textAlign: "right",
        },
        // The ingredients hang off a hairline rule, like a quoted block.
        children: {
            marginLeft: 6,
            borderLeftWidth: 1,
            borderLeftColor: colors.borderStrong,
            marginBottom: spacing.sm,
        },
        actions: {
            flexDirection: "row",
            gap: spacing.sm,
            paddingLeft: spacing.md,
            paddingTop: spacing.sm,
        },
    });
}
