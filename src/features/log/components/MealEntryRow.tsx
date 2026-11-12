import { getServingUnits } from "@/src/features/templates/services/templateDb";
import MacroNumbers from "@/src/shared/components/MacroNumbers";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatEntryQuantity } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { entryMacros } from "../helpers/logHelpers";
import type { EntryWithFood } from "./mealSectionContext";
import { useMealSelection } from "./mealSectionContext";
import SelectCheck from "./SelectCheck";

interface MealEntryRowProps {
    row: EntryWithFood;
    onEdit?: (row: EntryWithFood) => void;
    onConfirmEntry?: (id: number) => void;
    isFirst?: boolean;
}

/**
 * One logged food: name and amount, then its calories and macros. Tap to
 * edit (or delete) it in the entry sheet, long-press to start selecting. A
 * planned entry shows an empty circle that marks it as eaten — the same slot
 * holds the check while selecting.
 */
export default function MealEntryRow({ row, onEdit, onConfirmEntry, isFirst = false }: MealEntryRowProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const selection = useMealSelection();
    const food = row.foods;
    const entryUnit = row.entries.quantity_unit ?? "g";
    const servingGrams = food?.id ? getServingUnits(food.id).find((s) => s.name === entryUnit)?.grams : undefined;
    const selectionMode = selection?.selectionMode ?? false;
    const isSelected = selection?.selectedEntryIds.has(row.entries.id) ?? false;
    const isScheduled = row.entries.is_scheduled === 1;
    const canConfirm = isScheduled && !!onConfirmEntry && !selectionMode;

    return (
        <Pressable
            style={({ pressed }) => [
                styles.row,
                !isFirst && styles.divider,
                selectionMode && isSelected && styles.selected,
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
            {selectionMode && <SelectCheck checked={isSelected} />}
            {canConfirm && (
                <Pressable
                    onPress={() => onConfirmEntry(row.entries.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t("log.confirmEaten")}
                >
                    <Ionicons name="ellipse-outline" size={21} color={colors.textSecondary} />
                </Pressable>
            )}
            <View style={styles.info}>
                <Text style={[styles.name, isScheduled && styles.planned]} numberOfLines={1}>
                    {food?.name ?? t("log.unknownFood")}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>
                    {formatEntryQuantity(row.entries.quantity_grams, entryUnit, servingGrams)}
                    {isScheduled ? ` · ${t("log.planned")}` : ""}
                </Text>
            </View>
            <MacroNumbers {...entryMacros(row)} muted={isScheduled} style={styles.numbers} />
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 3,
            paddingVertical: spacing.sm + 4,
            paddingHorizontal: spacing.md,
        },
        divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        selected: { backgroundColor: colors.primaryLight },
        pressed: { backgroundColor: colors.surfaceMuted },
        info: { flex: 1, minWidth: 0 },
        name: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        detail: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
        planned: { color: colors.textTertiary },
        numbers: { alignSelf: "flex-start", marginTop: 1 },
    });
}
