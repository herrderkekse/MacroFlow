import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    ScrollView,
    StyleSheet,
    Pressable,
    Dimensions,
    type NativeSyntheticEvent,
    type NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing } from "@/src/utils/theme";
import { getEntriesByDate, deleteEntry, getGoals, type Food, type Entry, type Goals } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/types";
import logger from "@/src/utils/logger";
import MealSection from "./MealSection";
import DateSelectorBar from "./DateSelectorBar";
import DailyProgressBar from "./DailyProgressBar";

interface EntryWithFood {
    entries: Entry;
    foods: Food | null;
}

const SCREEN_WIDTH = Dimensions.get("window").width;

function getDateShifted(date: Date, delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    return d;
}

function loadGrouped(date: Date) {
    const rows = getEntriesByDate(date);
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
    return map;
}

function computeTotals(grouped: Record<MealType, EntryWithFood[]>) {
    const all = Object.values(grouped).flat();
    return all.reduce(
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
}

function DayPage({
    grouped,
    goals,
    onAdd,
    onDelete,
}: {
    grouped: Record<MealType, EntryWithFood[]>;
    goals: Goals;
    onAdd: (mt: MealType) => void;
    onDelete: (id: number) => void;
}) {
    return (
        <View style={styles.dayPage}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
            >
                <DailyProgressBar totals={computeTotals(grouped)} goals={goals} />
                {MEAL_TYPES.map((meal) => (
                    <MealSection
                        key={meal.key}
                        mealType={meal.key}
                        label={meal.label}
                        icon={meal.icon}
                        items={grouped[meal.key]}
                        onAdd={() => onAdd(meal.key)}
                        onDeleteEntry={onDelete}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

export default function LogScreen() {
    const selectedDate = useAppStore((s) => s.selectedDate);
    const setSelectedDate = useAppStore((s) => s.setSelectedDate);
    const dateRef = useRef(selectedDate);
    dateRef.current = selectedDate;

    const carouselRef = useRef<ScrollView>(null);
    const isSettling = useRef(false);

    const [grouped, setGrouped] = useState<Record<MealType, EntryWithFood[]>>({
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
    });
    const [prevGrouped, setPrevGrouped] = useState<Record<MealType, EntryWithFood[]>>({
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
    });
    const [nextGrouped, setNextGrouped] = useState<Record<MealType, EntryWithFood[]>>({
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

    function loadAllDays(center: Date) {
        setGrouped(loadGrouped(center));
        setPrevGrouped(loadGrouped(getDateShifted(center, -1)));
        setNextGrouped(loadGrouped(getDateShifted(center, +1)));
        const g = getGoals();
        if (g) setDailyGoals(g);
    }

    useFocusEffect(
        useCallback(() => {
            loadAllDays(selectedDate);
        }, [selectedDate]),
    );

    // After date changes (from any source), snap carousel back to center page.
    // Delay re-enabling swipe detection so any residual scroll events are ignored.
    useEffect(() => {
        carouselRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
        const timer = setTimeout(() => {
            isSettling.current = false;
        }, 150);
        return () => clearTimeout(timer);
    }, [selectedDate]);

    function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
        if (isSettling.current) return;
        const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (page === 0) {
            isSettling.current = true;
            const newDate = getDateShifted(dateRef.current, -1);
            loadAllDays(newDate);
            setSelectedDate(newDate);
        } else if (page === 2) {
            isSettling.current = true;
            const newDate = getDateShifted(dateRef.current, 1);
            loadAllDays(newDate);
            setSelectedDate(newDate);
        }
    }

    function handleDelete(id: number) {
        deleteEntry(id);
        logger.info("[DB] Deleted entry", { id });
        loadAllDays(selectedDate);
    }

    function navigateToAdd(mealType?: MealType) {
        router.push({
            pathname: "/log/add",
            params: mealType ? { mealType } : undefined,
        });
    }

    return (
        <View style={styles.screen}>
            <View style={styles.dateSelectorWrapper}>
                <DateSelectorBar
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                />
            </View>

            <ScrollView
                ref={carouselRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={handleScrollEnd}
                contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
                style={styles.carousel}
            >
                <DayPage
                    grouped={prevGrouped}
                    goals={dailyGoals}
                    onAdd={navigateToAdd}
                    onDelete={handleDelete}
                />
                <DayPage
                    grouped={grouped}
                    goals={dailyGoals}
                    onAdd={navigateToAdd}
                    onDelete={handleDelete}
                />
                <DayPage
                    grouped={nextGrouped}
                    goals={dailyGoals}
                    onAdd={navigateToAdd}
                    onDelete={handleDelete}
                />
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
    dateSelectorWrapper: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
    carousel: { flex: 1 },
    dayPage: { width: SCREEN_WIDTH },
    content: { padding: spacing.md, paddingBottom: 100 },
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
