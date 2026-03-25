import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { copyEntriesToDate, deleteEntry, deleteRecipeLog, formatDateKey, getEntriesByDate, getGoals, moveEntriesToDate, updateRecipeLogPortion, type Entry, type Food, type Goals } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import { MEAL_TYPES, type MealType } from "@/src/types";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DailyProgressBar from "./DailyProgressBar";
import DateSelectorBar from "./DateSelectorBar";
import EntryModal from "./EntryModal";
import MealSection, { type RecipeGroup } from "./MealSection";
import MoveCopyModal from "./MoveCopyModal";

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
    onEdit,
    onEditRecipeGroup,
    onDeleteRecipeLog,
    selectionMode,
    selectedEntryIds,
    onToggleEntries,
    onActivateSelection,
    onActivateSelectionMultiple,
}: {
    grouped: Record<MealType, EntryWithFood[]>;
    goals: Goals;
    onAdd: (mt: MealType) => void;
    onDelete: (id: number) => void;
    onEdit: (row: EntryWithFood) => void;
    onEditRecipeGroup: (group: RecipeGroup, multiplier: number) => void;
    onDeleteRecipeLog: (recipeLogId: number) => void;
    selectionMode?: boolean;
    selectedEntryIds?: Set<number>;
    onToggleEntries?: (entryIds: number[]) => void;
    onActivateSelection?: (entryId: number) => void;
    onActivateSelectionMultiple?: (entryIds: number[]) => void;
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
                        onEdit={onEdit}
                        onEditRecipeGroup={onEditRecipeGroup}
                        onDeleteRecipeLog={onDeleteRecipeLog}
                        selectionMode={selectionMode}
                        selectedEntryIds={selectedEntryIds}
                        onToggleEntries={onToggleEntries}
                        onActivateSelection={onActivateSelection}
                        onActivateSelectionMultiple={onActivateSelectionMultiple}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

export default function LogScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
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
        unit_system: "metric",
        language: "en",
    });

    const [editingEntry, setEditingEntry] = useState<EntryWithFood | null>(null);
    const [editingRecipeGroup, setEditingRecipeGroup] = useState<{
        group: RecipeGroup;
        multiplier: number;
    } | null>(null);
    const [portionInput, setPortionInput] = useState("1");

    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
    const [moveModalVisible, setMoveModalVisible] = useState(false);

    function loadAllDays(center: Date) {
        setGrouped(loadGrouped(center));
        setPrevGrouped(loadGrouped(getDateShifted(center, -1)));
        setNextGrouped(loadGrouped(getDateShifted(center, +1)));
        const g = getGoals();
        if (g) {
            setDailyGoals(g);
            // Sync unit system from DB into store
            if (g.unit_system === "metric" || g.unit_system === "imperial") {
                useAppStore.getState().setUnitSystem(g.unit_system as "metric" | "imperial");
            }
        }
    }

    useFocusEffect(
        useCallback(() => {
            loadAllDays(selectedDate);
            return () => {
                setSelectionMode(false);
                setSelectedEntryIds(new Set());
            };
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

    function handleDeleteRecipeLog(recipeLogId: number) {
        deleteRecipeLog(recipeLogId);
        logger.info("[DB] Deleted recipe log", { recipeLogId });
        loadAllDays(selectedDate);
    }

    function handleEdit(row: EntryWithFood) {
        setEditingEntry(row);
    }

    function handleEditRecipeGroup(group: RecipeGroup, multiplier: number) {
        setEditingRecipeGroup({ group, multiplier });
        setPortionInput(String(multiplier));
    }

    function handleSavePortionMultiplier() {
        if (!editingRecipeGroup) return;
        const newMultiplier = Math.max(0, parseFloat(portionInput) || 0);
        if (newMultiplier <= 0) return;
        updateRecipeLogPortion(
            editingRecipeGroup.group.recipeLogId,
            newMultiplier,
        );
        logger.info("[DB] Updated recipe log portion", {
            recipeLogId: editingRecipeGroup.group.recipeLogId,
            newMultiplier,
        });
        setEditingRecipeGroup(null);
        loadAllDays(selectedDate);
    }

    function navigateToAdd(mealType?: MealType) {
        router.push({
            pathname: "/log/add",
            params: mealType ? { mealType } : undefined,
        });
    }

    function exitSelectionMode() {
        setSelectionMode(false);
        setSelectedEntryIds(new Set());
    }

    function handleToggleEntries(entryIds: number[]) {
        setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            const allSelected = entryIds.every((id) => next.has(id));
            if (allSelected) {
                entryIds.forEach((id) => next.delete(id));
            } else {
                entryIds.forEach((id) => next.add(id));
            }
            if (next.size === 0) setSelectionMode(false);
            return next;
        });
    }

    function handleActivateSelection(entryId: number) {
        setSelectionMode(true);
        setSelectedEntryIds(new Set([entryId]));
    }

    function handleActivateSelectionMultiple(entryIds: number[]) {
        setSelectionMode(true);
        setSelectedEntryIds(new Set(entryIds));
    }

    function handleMoveCopy(targetDate: Date, targetMealType: string | null, action: "move" | "copy") {
        const allEntries = Object.values(grouped).flat();
        const recipeLogEntryMap = new Map<number, number[]>();
        for (const row of allEntries) {
            const rlId = row.entries.recipe_log_id;
            if (rlId) {
                const list = recipeLogEntryMap.get(rlId) ?? [];
                list.push(row.entries.id);
                recipeLogEntryMap.set(rlId, list);
            }
        }
        const fullySelectedRecipeLogIds: number[] = [];
        const standaloneEntryIds: number[] = [];
        for (const [rlId, entryIds] of recipeLogEntryMap) {
            const allSel = entryIds.every((id) => selectedEntryIds.has(id));
            if (allSel) {
                fullySelectedRecipeLogIds.push(rlId);
            } else {
                entryIds.filter((id) => selectedEntryIds.has(id)).forEach((id) => standaloneEntryIds.push(id));
            }
        }
        for (const row of allEntries) {
            if (!row.entries.recipe_log_id && selectedEntryIds.has(row.entries.id)) {
                standaloneEntryIds.push(row.entries.id);
            }
        }
        const dateKey = formatDateKey(targetDate);
        if (action === "move") {
            moveEntriesToDate(standaloneEntryIds, fullySelectedRecipeLogIds, dateKey, targetMealType);
        } else {
            copyEntriesToDate(standaloneEntryIds, fullySelectedRecipeLogIds, dateKey, targetMealType);
        }
        exitSelectionMode();
        setMoveModalVisible(false);
        setSelectedDate(targetDate);
    }

    function handleDateChange(newDate: Date) {
        exitSelectionMode();
        const diff = Math.round(
            (newDate.getTime() - dateRef.current.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diff === 1 || diff === -1) {
            isSettling.current = true;
            carouselRef.current?.scrollTo({
                x: diff === 1 ? 2 * SCREEN_WIDTH : 0,
                animated: true,
            });
            setTimeout(() => {
                loadAllDays(newDate);
                setSelectedDate(newDate);
            }, 350);
        } else {
            setSelectedDate(newDate);
        }
    }

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.dateSelectorWrapper}>
                <DateSelectorBar
                    date={selectedDate}
                    onDateChange={handleDateChange}
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
                scrollEnabled={!selectionMode}
            >
                <DayPage
                    grouped={prevGrouped}
                    goals={dailyGoals}
                    onAdd={navigateToAdd}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onEditRecipeGroup={handleEditRecipeGroup}
                    onDeleteRecipeLog={handleDeleteRecipeLog}
                />
                <DayPage
                    grouped={grouped}
                    goals={dailyGoals}
                    onAdd={navigateToAdd}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onEditRecipeGroup={handleEditRecipeGroup}
                    onDeleteRecipeLog={handleDeleteRecipeLog}
                    selectionMode={selectionMode}
                    selectedEntryIds={selectedEntryIds}
                    onToggleEntries={handleToggleEntries}
                    onActivateSelection={handleActivateSelection}
                    onActivateSelectionMultiple={handleActivateSelectionMultiple}
                />
                <DayPage
                    grouped={nextGrouped}
                    goals={dailyGoals}
                    onAdd={navigateToAdd}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onEditRecipeGroup={handleEditRecipeGroup}
                    onDeleteRecipeLog={handleDeleteRecipeLog}
                />
            </ScrollView>

            <EntryModal
                food={editingEntry?.foods ?? null}
                entry={editingEntry?.entries ?? null}
                onClose={() => setEditingEntry(null)}
                onSaved={() => {
                    setEditingEntry(null);
                    loadAllDays(selectedDate);
                }}
            />

            {/* Floating action button */}
            <Pressable
                style={({ pressed }) => [
                    styles.fab,
                    pressed && styles.fabPressed,
                ]}
                onPress={() => {
                    if (selectionMode) setMoveModalVisible(true);
                    else navigateToAdd();
                }}
            >
                <Ionicons name={selectionMode ? "move-outline" : "add"} size={28} color="#fff" />
            </Pressable>

            {/* Recipe portion edit modal */}
            <Modal
                visible={!!editingRecipeGroup}
                transparent
                animationType="fade"
                onRequestClose={() => setEditingRecipeGroup(null)}
            >
                <Pressable style={styles.overlay} onPress={() => setEditingRecipeGroup(null)}>
                    <Pressable style={styles.portionModal} onPress={() => { }}>
                        <Text style={styles.portionModalTitle}>
                            {t("log.adjustPortions")}
                        </Text>
                        <Text style={styles.portionModalSubtitle}>
                            {editingRecipeGroup?.group.recipeName}
                        </Text>
                        <View style={styles.portionRow}>
                            <Pressable
                                onPress={() => {
                                    const v = Math.max(0.25, (parseFloat(portionInput) || 1) - 0.25);
                                    setPortionInput(String(Math.round(v * 100) / 100));
                                }}
                                style={styles.portionBtn}
                            >
                                <Ionicons name="remove" size={20} color={colors.primary} />
                            </Pressable>
                            <Input
                                value={portionInput}
                                onChangeText={setPortionInput}
                                keyboardType="decimal-pad"
                                containerStyle={styles.portionInputContainer}
                                style={styles.portionInputText}
                            />
                            <Pressable
                                onPress={() => {
                                    const v = (parseFloat(portionInput) || 1) + 0.25;
                                    setPortionInput(String(Math.round(v * 100) / 100));
                                }}
                                style={styles.portionBtn}
                            >
                                <Ionicons name="add" size={20} color={colors.primary} />
                            </Pressable>
                        </View>
                        <Button title={t("common.save")} onPress={handleSavePortionMultiplier} />
                    </Pressable>
                </Pressable>
            </Modal>

            <MoveCopyModal
                visible={moveModalVisible}
                onClose={() => setMoveModalVisible(false)}
                onConfirm={handleMoveCopy}
                initialDate={selectedDate}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    dayPage: { width: SCREEN_WIDTH },
    content: { padding: spacing.md, paddingBottom: 100 },
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        dateSelectorWrapper: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
        carousel: { flex: 1 },
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
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        portionModal: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            width: "100%",
            maxWidth: 340,
        },
        portionModalTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.xs,
        },
        portionModalSubtitle: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        portionRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        portionBtn: {
            width: 40,
            height: 40,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },
        portionInputContainer: {
            flex: 1,
            marginBottom: 0,
        },
        portionInputText: {
            textAlign: "center",
            fontSize: fontSize.lg,
            fontWeight: "700",
        },
    });
}
