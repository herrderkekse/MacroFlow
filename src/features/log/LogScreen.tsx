import React, { useCallback, useState } from "react";
import { View, ScrollView, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, fontSize } from "@/src/utils/theme";
import { getEntriesByDate, deleteEntry, getGoals, type Food, type Entry, type Goals } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/types";
import logger from "@/src/utils/logger";
import MealSection from "./MealSection";
import DailyProgressBar from "./DailyProgressBar";

interface EntryWithFood {
    entries: Entry;
    foods: Food | null;
}

export default function LogScreen() {
    const selectedDate = useAppStore((s) => s.selectedDate);
    const [grouped, setGrouped] = useState<Record<MealType, EntryWithFood[]>>({
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
    });
    const [dailyGoals, setDailyGoals] = useState<Goals>({
        id: 1,
        calories: 2000,
        protein: 150,
        carbs: 250,
        fat: 70,
    });

    const loadEntries = useCallback(() => {
        const rows = getEntriesByDate(selectedDate);
        const map: Record<MealType, EntryWithFood[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
        };
        for (const row of rows) {
            const mt = row.entries.meal_type as MealType;
            if (map[mt]) map[mt].push(row);
        }
        setGrouped(map);

        const g = getGoals();
        if (g) setDailyGoals(g);
    }, [selectedDate]);

    useFocusEffect(
        useCallback(() => {
            loadEntries();
        }, [loadEntries]),
    );

    function handleDelete(id: number) {
        deleteEntry(id);
        logger.info("[DB] Deleted entry", { id });
        loadEntries();
    }

    function navigateToAdd(mealType?: MealType) {
        router.push({
            pathname: "/log/add",
            params: mealType ? { mealType } : undefined,
        });
    }

    const dateLabel = selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
    });

    const allEntries = Object.values(grouped).flat();
    const dailyTotals = allEntries.reduce(
        (acc, row) => {
            const qty = row.entries.quantity_grams;
            const food = row.foods;
            if (!food) return acc;
            return {
                calories: acc.calories + (food.calories_per_100g * qty) / 100,
                protein: acc.protein + (food.protein_per_100g * qty) / 100,
                carbs: acc.carbs + (food.carbs_per_100g * qty) / 100,
                fat: acc.fat + (food.fat_per_100g * qty) / 100,
            };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    return (
        <View style={styles.screen}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.dateLabel}>{dateLabel}</Text>

                <DailyProgressBar totals={dailyTotals} goals={dailyGoals} />

                {MEAL_TYPES.map((meal) => (
                    <MealSection
                        key={meal.key}
                        mealType={meal.key}
                        label={meal.label}
                        icon={meal.icon}
                        items={grouped[meal.key]}
                        onAdd={() => navigateToAdd(meal.key)}
                        onDeleteEntry={handleDelete}
                    />
                ))}
            </ScrollView>

            {/* Floating add button */}
            <Pressable
                style={({ pressed }) => [
                    styles.fab,
                    pressed && styles.fabPressed,
                ]}
                onPress={() => navigateToAdd()}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, paddingBottom: 100 },
    dateLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    fab: {
        position: "absolute",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    fabPressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
