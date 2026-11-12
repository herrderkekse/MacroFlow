import { getRecipeItems } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import MacroNumbers from "@/src/shared/components/MacroNumbers";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { sumMacros } from "../helpers/logHelpers";
import type { EntryWithFood, RecipeGroup } from "./mealSectionContext";
import { useMealSelection } from "./mealSectionContext";
import RecipeIngredientRow from "./RecipeIngredientRow";
import SelectCheck from "./SelectCheck";

interface RecipeGroupRowProps {
    group: RecipeGroup;
    onEdit?: (row: EntryWithFood) => void;
    onEditRecipeGroup?: (group: RecipeGroup, currentMultiplier: number) => void;
    onDeleteRecipeLog?: (recipeLogId: number) => void;
    onConfirmRecipeLog?: (recipeLogId: number) => void;
    isFirst?: boolean;
}

/**
 * A logged recipe: one row with the recipe's totals that opens into its
 * ingredients. The less common actions (adjust portions, delete) only
 * appear once it is open.
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
    const multiplier = group.portion;

    const isModified = useMemo(() => {
        const templateItems = getRecipeItems(group.recipeId);
        if (templateItems.length !== group.rows.length) return true;
        const templateMap = new Map(
            templateItems.map((item) => [item.recipe_items.food_id, item.recipe_items.quantity_grams]),
        );
        for (const row of group.rows) {
            const templateQty = templateMap.get(row.entries.food_id!);
            if (templateQty === undefined) return true;
            if (Math.abs(row.entries.quantity_grams - templateQty * multiplier) > 0.01) return true;
        }
        return false;
    }, [group.recipeId, group.rows, multiplier]);

    const selectionMode = selection?.selectionMode ?? false;
    const selectedEntryIds = selection?.selectedEntryIds ?? new Set<number>();
    const allGroupEntryIds = group.rows.map((r) => r.entries.id);
    const allGroupSelected = selectionMode && group.rows.length > 0 && group.rows.every((r) => selectedEntryIds.has(r.entries.id));
    const isGroupScheduled = group.rows.length > 0 && group.rows.every((r) => r.entries.is_scheduled === 1);
    const canConfirm = isGroupScheduled && !!onConfirmRecipeLog && !selectionMode;

    const detail = [
        group.recipeVariant ?? t("log.recipe"),
        t("common.itemCount", { count: group.rows.length }),
        isModified ? t("log.recipeModified") : null,
        isGroupScheduled ? t("log.planned") : null,
    ].filter(Boolean).join(" · ");

    return (
        <View style={!isFirst && styles.divider}>
            <Pressable
                style={({ pressed }) => [
                    styles.header,
                    allGroupSelected && styles.selected,
                    pressed && styles.pressed,
                ]}
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
                {selectionMode && <SelectCheck checked={allGroupSelected} />}
                {canConfirm && (
                    <Pressable
                        onPress={() => onConfirmRecipeLog(group.recipeLogId)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t("log.confirmEaten")}
                    >
                        <Ionicons name="ellipse-outline" size={21} color={colors.textSecondary} />
                    </Pressable>
                )}
                <View style={styles.info}>
                    <Text style={[styles.name, isGroupScheduled && styles.planned]} numberOfLines={1}>
                        {group.recipeName}
                        {multiplier !== 1 && <Text style={styles.portion}>{` · ×${multiplier}`}</Text>}
                    </Text>
                    <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
                </View>
                <View style={styles.side}>
                    <MacroNumbers {...sumMacros(group.rows)} muted={isGroupScheduled} />
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.textTertiary} />
                </View>
            </Pressable>

            {expanded && (
                <View style={styles.children}>
                    {group.rows.map((row, index) => (
                        <RecipeIngredientRow
                            key={row.entries.id}
                            row={row}
                            isLast={index === group.rows.length - 1}
                            onPress={() => {
                                if (selectionMode) selection?.toggleEntries([row.entries.id]);
                                else onEdit?.(row);
                            }}
                        />
                    ))}
                    {!selectionMode && (
                        <View style={styles.actions}>
                            {onEditRecipeGroup && (
                                <Button
                                    title={t("log.adjustPortions")}
                                    variant="ghost"
                                    size="sm"
                                    icon={<Ionicons name="resize-outline" size={15} color={colors.text} />}
                                    onPress={() => onEditRecipeGroup(group, multiplier)}
                                />
                            )}
                            <Button
                                title={t("common.delete")}
                                variant="ghost"
                                size="sm"
                                textStyle={{ color: colors.danger }}
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
            gap: spacing.sm + 3,
            paddingVertical: spacing.sm + 4,
            paddingHorizontal: spacing.md,
        },
        selected: { backgroundColor: colors.primaryLight },
        pressed: { backgroundColor: colors.surfaceMuted },
        info: { flex: 1, minWidth: 0 },
        name: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        portion: { fontSize: fontSize.xs, fontWeight: "500", color: colors.textTertiary },
        detail: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
        planned: { color: colors.textTertiary },
        side: { alignSelf: "flex-start", alignItems: "flex-end", gap: 2, marginTop: 1 },
        children: { paddingBottom: spacing.sm },
        actions: {
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing.xs,
            paddingTop: spacing.xs,
        },
    });
}
