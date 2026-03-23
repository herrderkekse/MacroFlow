import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";
import type { Food, Entry } from "@/src/db/queries";
import type { MealType } from "@/src/types";

interface EntryWithFood {
    entries: Entry;
    foods: Food | null;
}

interface MealSectionProps {
    mealType: MealType;
    label: string;
    icon: string;
    items: EntryWithFood[];
    onAdd: () => void;
    onDeleteEntry: (id: number) => void;
    onEdit?: (row: EntryWithFood) => void;
}

export default function MealSection({
    label,
    icon,
    items,
    onAdd,
    onDeleteEntry,
    onEdit,
}: MealSectionProps) {
    const totalCals = items.reduce((sum, row) => {
        const cals = row.foods?.calories_per_100g ?? 0;
        const qty = row.entries.quantity_grams;
        return sum + (cals * qty) / 100;
    }, 0);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons
                        name={icon as never}
                        size={18}
                        color={colors.textSecondary}
                    />
                    <Text style={styles.title}>{label}</Text>
                    {items.length > 0 && (
                        <Text style={styles.totalCals}>
                            {Math.round(totalCals)} cal
                        </Text>
                    )}
                </View>
                <Pressable onPress={onAdd} hitSlop={8}>
                    <Ionicons
                        name="add-circle-outline"
                        size={24}
                        color={colors.primary}
                    />
                </Pressable>
            </View>

            {items.length === 0 ? (
                <Text style={styles.empty}>No foods logged yet</Text>
            ) : (
                items.map((row) => {
                    const food = row.foods;
                    const qty = row.entries.quantity_grams;
                    const cals = food
                        ? Math.round((food.calories_per_100g * qty) / 100)
                        : 0;

                    return (
                        <Pressable
                            key={row.entries.id}
                            style={styles.entryRow}
                            onPress={() => onEdit?.(row)}
                            android_ripple={{ color: '#00000004' }}
                        >
                            <View style={styles.entryInfo}>
                                <Text style={styles.entryName} numberOfLines={1}>
                                    {food?.name ?? "Unknown food"}
                                </Text>
                                <Text style={styles.entryDetail}>
                                    {qty}g · {cals} cal
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => onDeleteEntry(row.entries.id)}
                                hitSlop={8}
                            >
                                <Ionicons
                                    name="close-circle-outline"
                                    size={20}
                                    color={colors.textTertiary}
                                />
                            </Pressable>
                        </Pressable>
                    );
                })
            )}
        </View>
    );
}

const styles = StyleSheet.create({
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
    totalCals: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    empty: {
        fontSize: fontSize.sm,
        color: colors.textTertiary,
        fontStyle: "italic",
        paddingVertical: spacing.xs,
    },
    entryRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    entryInfo: { flex: 1, marginRight: spacing.sm },
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
});
