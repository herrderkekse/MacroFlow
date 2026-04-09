import { getServingUnits } from "@/src/features/templates/services/templateDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatEntryQuantity } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EntryWithFood } from "./mealSectionContext";
import { useMealSelection } from "./mealSectionContext";

export default function MealEntryRow({
    row,
    onEdit,
    onDeleteEntry,
    onConfirmEntry,
    isChild = false,
    allMealSelected,
    allGroupSelected,
}: {
    row: EntryWithFood;
    onEdit?: (row: EntryWithFood) => void;
    onDeleteEntry: (id: number) => void;
    onConfirmEntry?: (id: number) => void;
    isChild?: boolean;
    allMealSelected?: boolean;
    allGroupSelected?: boolean;
}) {
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

    return (
        <Pressable
            style={[
                styles.entryRow,
                isChild && styles.childEntryRow,
                selectionMode && isSelected && !allMealSelected && !allGroupSelected && styles.selectedEntry,
                isScheduled && styles.scheduledEntry,
            ]}
            onPress={() => {
                if (selectionMode) selection?.toggleEntries([row.entries.id]);
                else onEdit?.(row);
            }}
            onLongPress={() => {
                if (selectionMode) selection?.toggleEntries([row.entries.id]);
                else selection?.activateSelection(row.entries.id);
            }}
            android_ripple={{ color: "#00000004" }}
        >
            {isChild && <View style={styles.childConnector} />}
            <View style={styles.entryInfo}>
                <View style={styles.entryNameRow}>
                    <Text style={[styles.entryName, isScheduled && styles.scheduledText]} numberOfLines={1}>
                        {food?.name ?? t("log.unknownFood")}
                    </Text>
                    {isScheduled && (
                        <Ionicons name="calendar-outline" size={14} color={colors.disabled} style={{ marginLeft: 4 }} />
                    )}
                </View>
                <Text style={[styles.entryDetail, isScheduled && styles.scheduledText]}>
                    {formatEntryQuantity(qty, entryUnit, servingGrams)} · {cals} {t("common.cal")}
                </Text>
            </View>
            {!selectionMode && (
                <View style={styles.entryActions}>
                    {isScheduled && !isChild && onConfirmEntry && (
                        <Pressable onPress={() => onConfirmEntry(row.entries.id)} hitSlop={8} style={{ marginRight: spacing.sm }}>
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={20}
                                color={colors.success}
                            />
                        </Pressable>
                    )}
                    <Pressable onPress={() => onDeleteEntry(row.entries.id)} hitSlop={8}>
                        <Ionicons
                            name="close-circle-outline"
                            size={20}
                            color={colors.textTertiary}
                        />
                    </Pressable>
                </View>
            )}
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        entryRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        childEntryRow: {
            paddingLeft: spacing.sm,
        },
        selectedEntry: {
            borderWidth: 1.5,
            borderTopWidth: 1.5,
            borderColor: colors.primary,
            borderTopColor: colors.primary,
            borderRadius: borderRadius.sm,
            marginVertical: 2,
            zIndex: 1,
        },
        scheduledEntry: {
            opacity: 0.6,
        },
        scheduledText: {
            color: colors.disabled,
        },
        childConnector: {
            width: 8,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.primary + "40",
            marginRight: spacing.xs,
            alignSelf: "center",
        },
        entryInfo: { flex: 1, marginRight: spacing.sm },
        entryNameRow: {
            flexDirection: "row",
            alignItems: "center",
        },
        entryName: {
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.text,
        },
        entryDetail: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginTop: 2,
        },
        entryActions: {
            flexDirection: "row",
            alignItems: "center",
        },
    });
}
