import { getAllFoods } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { AiMealPlanEntry } from "../types/types";

interface MealPlanToolResultProps {
    entries: AiMealPlanEntry[];
    colors: ThemeColors;
    onImport?: () => void;
    onDismiss?: () => void;
    /** When true, shows a loading indicator and no action buttons. */
    generating?: boolean;
}

export default function MealPlanToolResult({
    entries,
    colors,
    onImport,
    onDismiss,
    generating,
}: MealPlanToolResultProps) {
    const { t } = useTranslation();

    const grouped = useMemo(() => {
        const allFoods = getAllFoods();
        const foodMap = new Map(allFoods.map((f) => [f.id, f]));
        const map = new Map<string, (AiMealPlanEntry & { foodName: string; calories: number })[]>();
        for (const e of entries) {
            const food = foodMap.get(e.food_id);
            const item = {
                ...e,
                foodName: food?.name ?? t("common.unknown"),
                calories: food ? Math.round((food.calories_per_100g * e.quantity_grams) / 100) : 0,
            };
            const arr = map.get(e.date) ?? [];
            arr.push(item);
            map.set(e.date, arr);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [entries, t]);

    return (
        <View style={[styles.container, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
                <Text style={[styles.headerText, { color: colors.text }]}>
                    {t("chat.mealPlanPreview")}
                </Text>
                <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
                    {t("common.itemCount", { count: entries.length })}
                </Text>
            </View>

            {grouped.map(([date, dayEntries]) => (
                <View key={date} style={[styles.dayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.dayHeading, { color: colors.text }]}>{date}</Text>
                    {dayEntries.map((entry, i) => (
                        <View key={`${entry.food_id}-${i}`} style={styles.entryRow}>
                            <Text style={[styles.mealBadge, { color: colors.primary }]}>
                                {t(`meal.${entry.meal_type}`)}
                            </Text>
                            <Text style={[styles.entryFood, { color: colors.text }]} numberOfLines={1}>
                                {entry.foodName}
                            </Text>
                            <Text style={[styles.entryDetail, { color: colors.textSecondary }]}>
                                {Math.round(entry.quantity_grams)}g · {entry.calories} {t("common.kcal")}
                            </Text>
                        </View>
                    ))}
                </View>
            ))}

            <View style={styles.actions}>
                {generating ? (
                    <View style={styles.generatingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.generatingText, { color: colors.textSecondary }]}>
                            {t("chat.thinking")}
                        </Text>
                    </View>
                ) : (
                    <>
                        <Button
                            title={t("chat.importMealPlan")}
                            onPress={onImport!}
                            variant="primary"
                            style={styles.actionBtn}
                            icon={<Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />}
                        />
                        <Button
                            title={t("common.cancel")}
                            onPress={onDismiss!}
                            variant="outline"
                            style={styles.actionBtn}
                        />
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    headerText: {
        flex: 1,
        fontSize: fontSize.sm,
        fontWeight: "600",
    },
    headerCount: {
        fontSize: fontSize.xs,
    },
    dayCard: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        padding: spacing.sm,
        margin: spacing.sm,
        marginBottom: 0,
    },
    dayHeading: {
        fontSize: fontSize.sm,
        fontWeight: "700",
        marginBottom: spacing.xs,
    },
    entryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: 2,
    },
    mealBadge: {
        fontSize: fontSize.xs,
        fontWeight: "600",
        width: 65,
    },
    entryFood: {
        flex: 1,
        fontSize: fontSize.xs,
    },
    entryDetail: {
        fontSize: fontSize.xs,
    },
    actions: {
        flexDirection: "row",
        gap: spacing.sm,
        padding: spacing.sm,
        paddingTop: spacing.md,
    },
    actionBtn: {
        flex: 1,
    },
    generatingRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    generatingText: {
        fontSize: fontSize.sm,
    },
});
