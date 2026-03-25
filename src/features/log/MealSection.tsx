import type { Entry, Food } from "@/src/db/queries";
import { getRecipeById, getRecipeItems, getRecipeLogById } from "@/src/db/queries";
import type { MealType } from "@/src/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { type FoodUnit, formatQuantity, fromGrams } from "@/src/utils/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

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
    onEditRecipeGroup?: (group: RecipeGroup, currentMultiplier: number) => void;
    onDeleteRecipeLog?: (recipeLogId: number) => void;
}

export interface RecipeGroup {
    recipeLogId: number;
    recipeId: number;
    recipeName: string;
    portion: number;
    rows: EntryWithFood[];
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
    label,
    icon,
    items,
    onAdd,
    onDeleteEntry,
    onEdit,
    onEditRecipeGroup,
    onDeleteRecipeLog,
}: MealSectionProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
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
                <Text style={styles.empty}>{t("log.noFoodsLogged")}</Text>
            ) : (
                <>
                    {/* Recipe groups */}
                    {recipeGroups.map((rg) => (
                        <RecipeGroupRow
                            key={rg.recipeLogId}
                            group={rg}
                            onEdit={onEdit}
                            onDeleteEntry={onDeleteEntry}
                            onEditRecipeGroup={onEditRecipeGroup}
                            onDeleteRecipeLog={onDeleteRecipeLog}
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
    isChild = false,
}: {
    row: EntryWithFood;
    onEdit?: (row: EntryWithFood) => void;
    onDeleteEntry: (id: number) => void;
    isChild?: boolean;
}) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const food = row.foods;
    const qty = row.entries.quantity_grams;
    const entryUnit = (row.entries.quantity_unit ?? "g") as FoodUnit;
    const displayQty = fromGrams(qty, entryUnit);
    const cals = food ? Math.round((food.calories_per_100g * qty) / 100) : 0;

    return (
        <Pressable
            style={[styles.entryRow, isChild && styles.childEntryRow]}
            onPress={() => onEdit?.(row)}
            android_ripple={{ color: "#00000004" }}
        >
            {isChild && <View style={styles.childConnector} />}
            <View style={styles.entryInfo}>
                <Text style={styles.entryName} numberOfLines={1}>
                    {food?.name ?? t("log.unknownFood")}
                </Text>
                <Text style={styles.entryDetail}>
                    {formatQuantity(Math.round(displayQty * 10) / 10, entryUnit)} · {cals} cal
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
    onEditRecipeGroup,
    onDeleteRecipeLog,
}: {
    group: RecipeGroup;
    onEdit?: (row: EntryWithFood) => void;
    onDeleteEntry: (id: number) => void;
    onEditRecipeGroup?: (group: RecipeGroup, currentMultiplier: number) => void;
    onDeleteRecipeLog?: (recipeLogId: number) => void;
}) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
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

    const displayName = multiplier !== 1
        ? `${multiplier}x ${group.recipeName}`
        : group.recipeName;

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
                <Ionicons
                    name={isModified ? "create-outline" : "book-outline"}
                    size={16}
                    color={isModified ? colors.textSecondary : colors.primary}
                    style={{ marginLeft: 4 }}
                />
                <Text style={styles.recipeName} numberOfLines={1}>
                    {displayName}
                </Text>
                <Text style={styles.recipeDetail}>
                    {group.rows.length} items · {Math.round(totalCals)} cal
                </Text>
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
            </Pressable>

            {expanded && (
                <View style={styles.childContainer}>
                    {group.rows.map((row) => (
                        <EntryRow
                            key={row.entries.id}
                            row={row}
                            onEdit={onEdit}
                            onDeleteEntry={onDeleteEntry}
                            isChild
                        />
                    ))}
                </View>
            )}
        </View>
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
        childContainer: {
            borderLeftWidth: 2,
            borderLeftColor: colors.primary + "40",
            marginLeft: spacing.sm,
        },
        childEntryRow: {
            paddingLeft: spacing.sm,
        },
        childConnector: {
            width: 8,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.primary + "40",
            marginRight: spacing.xs,
            alignSelf: "center",
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
}
