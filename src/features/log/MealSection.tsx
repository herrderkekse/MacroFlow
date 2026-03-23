import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";
import type { Food, Entry } from "@/src/db/queries";
import { getRecipeById } from "@/src/db/queries";
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

interface RecipeGroup {
    group: string;
    recipeId: number;
    recipeName: string;
    rows: EntryWithFood[];
}

function groupEntries(items: EntryWithFood[]) {
    const standalone: EntryWithFood[] = [];
    const recipeMap = new Map<string, EntryWithFood[]>();

    for (const item of items) {
        const g = item.entries.recipe_log_group;
        if (g) {
            const list = recipeMap.get(g) ?? [];
            list.push(item);
            recipeMap.set(g, list);
        } else {
            standalone.push(item);
        }
    }

    const recipeGroups: RecipeGroup[] = [];
    for (const [group, rows] of recipeMap) {
        const recipeId = rows[0].entries.recipe_id!;
        const recipe = getRecipeById(recipeId);
        recipeGroups.push({
            group,
            recipeId,
            recipeName: recipe?.name ?? "Recipe",
            rows,
        });
    }

    return { standalone, recipeGroups };
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

    const { standalone, recipeGroups } = groupEntries(items);

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
                <>
                    {/* Recipe groups */}
                    {recipeGroups.map((rg) => (
                        <RecipeGroupRow
                            key={rg.group}
                            group={rg}
                            onEdit={onEdit}
                            onDeleteEntry={onDeleteEntry}
                        />
                    ))}

                    {/* Standalone entries */}
                    {standalone.map((row) => (
                        <EntryRow
                            key={row.entries.id}
                            row={row}
                            onEdit={onEdit}
                            onDeleteEntry={onDeleteEntry}
                        />
                    ))}
                </>
            )}
        </View>
    );
}

function EntryRow({
    row,
    onEdit,
    onDeleteEntry,
}: {
    row: EntryWithFood;
    onEdit?: (row: EntryWithFood) => void;
    onDeleteEntry: (id: number) => void;
}) {
    const food = row.foods;
    const qty = row.entries.quantity_grams;
    const cals = food ? Math.round((food.calories_per_100g * qty) / 100) : 0;

    return (
        <Pressable
            style={styles.entryRow}
            onPress={() => onEdit?.(row)}
            android_ripple={{ color: "#00000004" }}
        >
            <View style={styles.entryInfo}>
                <Text style={styles.entryName} numberOfLines={1}>
                    {food?.name ?? "Unknown food"}
                </Text>
                <Text style={styles.entryDetail}>
                    {qty}g · {cals} cal
                </Text>
            </View>
            <Pressable onPress={() => onDeleteEntry(row.entries.id)} hitSlop={8}>
                <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={colors.textTertiary}
                />
            </Pressable>
        </Pressable>
    );
}

function RecipeGroupRow({
    group,
    onEdit,
    onDeleteEntry,
}: {
    group: RecipeGroup;
    onEdit?: (row: EntryWithFood) => void;
    onDeleteEntry: (id: number) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const totalCals = group.rows.reduce((sum, row) => {
        const food = row.foods;
        if (!food) return sum;
        return sum + (food.calories_per_100g * row.entries.quantity_grams) / 100;
    }, 0);

    return (
        <View style={styles.recipeGroup}>
            <Pressable
                style={styles.recipeHeader}
                onPress={() => setExpanded(!expanded)}
            >
                <Ionicons
                    name={expanded ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={colors.textSecondary}
                />
                <Ionicons name="book-outline" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
                <Text style={styles.recipeName} numberOfLines={1}>
                    {group.recipeName}
                </Text>
                <Text style={styles.recipeDetail}>
                    {group.rows.length} items · {Math.round(totalCals)} cal
                </Text>
                <Pressable
                    onPress={() => {
                        for (const row of group.rows) onDeleteEntry(row.entries.id);
                    }}
                    hitSlop={8}
                >
                    <Ionicons name="close-circle-outline" size={20} color={colors.textTertiary} />
                </Pressable>
            </Pressable>

            {expanded &&
                group.rows.map((row) => (
                    <EntryRow
                        key={row.entries.id}
                        row={row}
                        onEdit={onEdit}
                        onDeleteEntry={onDeleteEntry}
                    />
                ))}
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
    recipeGroup: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
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
});
