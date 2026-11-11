import { getServingUnits } from "@/src/features/templates/services/templateDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatEntryQuantity } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EntryWithFood } from "./mealSectionContext";
import { useMealSelection } from "./mealSectionContext";

interface MealEntryRowProps {
    row: EntryWithFood;
    onEdit?: (row: EntryWithFood) => void;
    onConfirmEntry?: (id: number) => void;
    /** An ingredient of a logged recipe, shown indented under its group. */
    isChild?: boolean;
    isFirst?: boolean;
}

/**
 * One logged food. Tap to edit (or delete) it in the entry sheet, long-press
 * to start selecting. A planned entry shows an empty circle that marks it as
 * eaten — the same slot holds the checkbox while selecting.
 */
export default function MealEntryRow({ row, onEdit, onConfirmEntry, isChild = false, isFirst = false }: MealEntryRowProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const selection = useMealSelection();
    const food = row.foods;
    const qty = row.entries.quantity_grams;
    const entryUnit = row.entries.quantity_unit ?? "g";
    const servingGrams = food?.id ? getServingUnits(food.id).find((s) => s.name === entryUnit)?.grams : undefined;
    const cals = food ? Math.round((food.calories_per_100g * qty) / 100) : 0;
    const selectionMode = selection?.selectionMode ?? false;
    const isSelected = selection?.selectedEntryIds.has(row.entries.id) ?? false;
    const isScheduled = row.entries.is_scheduled === 1;
    const canConfirm = isScheduled && !isChild && !!onConfirmEntry && !selectionMode;

    return (
        <Pressable
            style={({ pressed }) => [
                styles.row,
                !isFirst && styles.divider,
                isChild && styles.childRow,
                pressed && styles.pressed,
            ]}
            onPress={() => {
                if (selectionMode) selection?.toggleEntries([row.entries.id]);
                else onEdit?.(row);
            }}
            onLongPress={() => {
                if (selectionMode) selection?.toggleEntries([row.entries.id]);
                else selection?.activateSelection(row.entries.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: selectionMode ? isSelected : undefined }}
        >
            {selectionMode && (
                <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={isSelected ? colors.primary : colors.textTertiary}
                />
            )}
            {canConfirm && (
                <Pressable
                    onPress={() => onConfirmEntry(row.entries.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t("log.confirmEaten")}
                >
                    <Ionicons name="ellipse-outline" size={22} color={colors.textSecondary} />
                </Pressable>
            )}
            <View style={styles.info}>
                <Text style={[styles.name, isScheduled && styles.planned]} numberOfLines={1}>
                    {food?.name ?? t("log.unknownFood")}
                </Text>
                <Text style={[styles.detail, isScheduled && styles.planned]} numberOfLines={1}>
                    {formatEntryQuantity(qty, entryUnit, servingGrams)}
                    {isScheduled ? ` · ${t("log.planned")}` : ""}
                </Text>
            </View>
            <Text style={[styles.calories, isScheduled && styles.planned]}>{cals}</Text>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 2,
            minHeight: 52,
            paddingVertical: spacing.sm,
        },
        divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        childRow: { minHeight: 44, paddingLeft: spacing.md },
        pressed: { opacity: 0.6 },
        info: { flex: 1 },
        name: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text },
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
    });
}
