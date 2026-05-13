import { getGoals, getNotificationSettings, type Goals } from "@/src/features/settings/services/settingsDb";
import { cancelWeightReminderIfLogged, syncTodayMealReminders, syncTodayWeightReminder } from "@/src/services/notifications";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { type MealType } from "@/src/shared/types";
import { diffCalendarDays, diffDateKeys, shiftCalendarDate } from "@/src/utils/date";
import logger from "@/src/utils/logger";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from "react-native";
import { computeWeightTrend, loadGrouped, type EntryWithFood } from "../helpers/logHelpers";
import { addWeightLog, confirmEntry, confirmRecipeLog, copyEntriesToDate, copyEntriesToRecipeLog, createRecipeFromEntries, deleteEntry, deleteRecipeLog, deleteWeightLog, formatDateKey, getEntriesByDate, getWeightLogsForDate, getWeightLogsForRange, moveEntriesToDate, moveEntriesToRecipeLog, updateRecipeLogPortion, type RecipeGroup, type WeightLog } from "../services/logDb";

const SCREEN_WIDTH = Dimensions.get("window").width;

export function useLogData() {
    const { t } = useTranslation();
    const selectedDate = useAppStore((s) => s.selectedDate);
    const setSelectedDate = useAppStore((s) => s.setSelectedDate);
    const dateRef = useRef(selectedDate);
    dateRef.current = selectedDate;

    const carouselRef = useRef<ScrollView>(null);
    const isSettling = useRef(false);
    const [chatBarVisible, setChatBarVisible] = useState(false);

    const emptyGrouped = () => ({
        breakfast: [] as EntryWithFood[],
        lunch: [] as EntryWithFood[],
        dinner: [] as EntryWithFood[],
        snack: [] as EntryWithFood[],
    });

    const [grouped, setGrouped] = useState(emptyGrouped);
    const [prevGrouped, setPrevGrouped] = useState(emptyGrouped);
    const [nextGrouped, setNextGrouped] = useState(emptyGrouped);
    const [dailyGoals, setDailyGoals] = useState<Goals>({
        id: 1, calories: 2000, protein: 150, carbs: 250, fat: 70,
        unit_system: "metric", language: "en", appearance_mode: "system", keep_awake: 0,
    });

    const [editingEntry, setEditingEntry] = useState<EntryWithFood | null>(null);
    const [editingRecipeGroup, setEditingRecipeGroup] = useState<{ group: RecipeGroup; multiplier: number } | null>(null);
    const [portionInput, setPortionInput] = useState("1");

    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
    const [moveModalVisible, setMoveModalVisible] = useState(false);

    const [weightTrend, setWeightTrend] = useState<"up" | "down" | "flat" | null>(null);
    const [dayWeightLogs, setDayWeightLogs] = useState<WeightLog[]>([]);
    const [meanWeightKg, setMeanWeightKg] = useState<number | null>(null);
    const [weightDaysAgo, setWeightDaysAgo] = useState<number | null>(null);
    const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0);

    function loadAllDays(center: Date) {
        setGrouped(loadGrouped(center));
        setPrevGrouped(loadGrouped(shiftCalendarDate(center, -1)));
        setNextGrouped(loadGrouped(shiftCalendarDate(center, +1)));
        const g = getGoals();
        if (g) {
            setDailyGoals(g);
            if (g.unit_system === "metric" || g.unit_system === "imperial") {
                useAppStore.getState().setUnitSystem(g.unit_system as "metric" | "imperial");
            }
            useAppStore.getState().setKeepAwakeInWorkout(g.keep_awake !== 0);
        }
        const dayWeights = getWeightLogsForDate(center);
        setDayWeightLogs(dayWeights);
        if (dayWeights.length > 0) {
            setMeanWeightKg(dayWeights.reduce((s, w) => s + w.weight_kg, 0) / dayWeights.length);
            setWeightDaysAgo(0);
        } else {
            const twoMonthsBefore = shiftCalendarDate(center, -60);
            const pastLogs = getWeightLogsForRange(formatDateKey(twoMonthsBefore), formatDateKey(center));
            if (pastLogs.length > 0) {
                const lastDate = pastLogs[pastLogs.length - 1].date;
                const lastDayLogs = pastLogs.filter((w) => w.date === lastDate);
                setMeanWeightKg(lastDayLogs.reduce((s, w) => s + w.weight_kg, 0) / lastDayLogs.length);
                setWeightDaysAgo(diffDateKeys(formatDateKey(center), lastDate));
            } else {
                setMeanWeightKg(null);
                setWeightDaysAgo(null);
            }
        }
        const twoWeeksBefore = shiftCalendarDate(center, -14);
        const rangeLogs = getWeightLogsForRange(formatDateKey(twoWeeksBefore), formatDateKey(center));
        setWeightTrend(computeWeightTrend(rangeLogs));
    }

    useFocusEffect(
        useCallback(() => {
            loadAllDays(selectedDate);
            setWorkoutRefreshKey((k) => k + 1);
            return () => { setSelectionMode(false); setSelectedEntryIds(new Set()); };
        }, [selectedDate]),
    );

    useEffect(() => {
        carouselRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
        const timer = setTimeout(() => { isSettling.current = false; }, 150);
        return () => clearTimeout(timer);
    }, [selectedDate]);

    function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
        if (isSettling.current) return;
        const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (page === 0) {
            isSettling.current = true;
            const newDate = shiftCalendarDate(dateRef.current, -1);
            loadAllDays(newDate);
            setSelectedDate(newDate);
        } else if (page === 2) {
            isSettling.current = true;
            const newDate = shiftCalendarDate(dateRef.current, 1);
            loadAllDays(newDate);
            setSelectedDate(newDate);
        }
    }

    const handleDelete = (id: number) => {
        deleteEntry(id);
        logger.info("[DB] Deleted entry", { id });
        const settings = getNotificationSettings() ?? null;
        const loggedMealTypes = new Set(getEntriesByDate(new Date()).map(e => e.entries.meal_type as MealType));
        syncTodayMealReminders(settings, loggedMealTypes);
        loadAllDays(selectedDate);
    };
    const handleDeleteRecipeLog = (id: number) => {
        deleteRecipeLog(id);
        logger.info("[DB] Deleted recipe log", { recipeLogId: id });
        const settings = getNotificationSettings() ?? null;
        const loggedMealTypes = new Set(getEntriesByDate(new Date()).map(e => e.entries.meal_type as MealType));
        syncTodayMealReminders(settings, loggedMealTypes);
        loadAllDays(selectedDate);
    };
    const handleConfirmEntry = (id: number) => { confirmEntry(id); logger.info("[DB] Confirmed scheduled entry", { id }); loadAllDays(selectedDate); };
    const handleConfirmRecipeLog = (id: number) => { confirmRecipeLog(id); logger.info("[DB] Confirmed scheduled recipe log", { recipeLogId: id }); loadAllDays(selectedDate); };
    const handleAddWeight = (kg: number) => {
        addWeightLog(kg, selectedDate);
        logger.info("[DB] Logged weight", { weight_kg: kg });
        cancelWeightReminderIfLogged(true);
        loadAllDays(selectedDate);
    };
    const handleDeleteWeight = (id: number) => {
        deleteWeightLog(id);
        logger.info("[DB] Deleted weight log", { id });
        const settings = getNotificationSettings() ?? null;
        const hasWeightLog = getWeightLogsForDate(new Date()).length > 0;
        syncTodayWeightReminder(settings, hasWeightLog);
        loadAllDays(selectedDate);
    };

    const handleEdit = (row: EntryWithFood) => setEditingEntry(row);

    const handleEditRecipeGroup = (group: RecipeGroup, multiplier: number) => {
        setEditingRecipeGroup({ group, multiplier });
        setPortionInput(String(multiplier));
    };

    function handleSavePortionMultiplier() {
        if (!editingRecipeGroup) return;
        const newMultiplier = Math.max(0, parseFloat(portionInput) || 0);
        if (newMultiplier <= 0) return;
        updateRecipeLogPortion(editingRecipeGroup.group.recipeLogId, newMultiplier);
        logger.info("[DB] Updated recipe log portion", { recipeLogId: editingRecipeGroup.group.recipeLogId, newMultiplier });
        setEditingRecipeGroup(null);
        loadAllDays(selectedDate);
    }

    const navigateToAdd = (mealType?: MealType) => {
        router.push({ pathname: "/log/add", params: mealType ? { mealType } : undefined });
    };

    function exitSelectionMode() { setSelectionMode(false); setSelectedEntryIds(new Set()); }

    function handleToggleEntries(entryIds: number[]) {
        setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            const allSelected = entryIds.every((id) => next.has(id));
            if (allSelected) entryIds.forEach((id) => next.delete(id));
            else entryIds.forEach((id) => next.add(id));
            if (next.size === 0) setSelectionMode(false);
            return next;
        });
    }

    const handleActivateSelection = (entryId: number) => { setSelectionMode(true); setSelectedEntryIds(new Set([entryId])); };
    const handleActivateSelectionMultiple = (entryIds: number[]) => { setSelectionMode(true); setSelectedEntryIds(new Set(entryIds)); };

    function handleMoveCopy(targetDate: Date, targetMealType: string | null, action: "move" | "copy", targetRecipeLogId: number | null) {
        const allEntries = Object.values(grouped).flat();
        const dateKey = formatDateKey(targetDate);

        if (targetRecipeLogId !== null) {
            // Move/copy all selected entries into the target recipe log
            const allSelectedEntryIds = allEntries
                .filter((row) => selectedEntryIds.has(row.entries.id))
                .map((row) => row.entries.id);
            // targetMealType is always non-null when a recipe is selected (recipe selector
            // only appears when a specific meal is selected), but fall back gracefully.
            const recipeMealType = targetMealType ?? "breakfast";
            if (action === "move") {
                moveEntriesToRecipeLog(allSelectedEntryIds, targetRecipeLogId, dateKey, recipeMealType);
            } else {
                copyEntriesToRecipeLog(allSelectedEntryIds, targetRecipeLogId, dateKey, recipeMealType);
            }
        } else {
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
                if (entryIds.every((id) => selectedEntryIds.has(id))) fullySelectedRecipeLogIds.push(rlId);
                else entryIds.filter((id) => selectedEntryIds.has(id)).forEach((id) => standaloneEntryIds.push(id));
            }
            for (const row of allEntries) {
                if (!row.entries.recipe_log_id && selectedEntryIds.has(row.entries.id)) standaloneEntryIds.push(row.entries.id);
            }
            if (action === "move") moveEntriesToDate(standaloneEntryIds, fullySelectedRecipeLogIds, dateKey, targetMealType);
            else copyEntriesToDate(standaloneEntryIds, fullySelectedRecipeLogIds, dateKey, targetMealType);
        }
        exitSelectionMode();
        setMoveModalVisible(false);
        loadAllDays(targetDate);
        setSelectedDate(targetDate);
    }

    function handleCreateRecipeFromSelection() {
        const selectedIds = Object.values(grouped)
            .flat()
            .filter((row) => selectedEntryIds.has(row.entries.id))
            .map((row) => row.entries.id);

        if (selectedIds.length === 0) return;

        const recipeName = t("log.newRecipeFromSelection", { date: formatDateKey(selectedDate) });
        const recipeId = createRecipeFromEntries(selectedIds, recipeName);
        if (!recipeId) return;

        exitSelectionMode();
        router.push({ pathname: "/templates/edit", params: { recipeId: String(recipeId) } });
    }

    function handleDateChange(newDate: Date) {
        exitSelectionMode();
        const diff = diffCalendarDays(newDate, dateRef.current);
        if (diff === 1 || diff === -1) {
            isSettling.current = true;
            carouselRef.current?.scrollTo({ x: diff === 1 ? 2 * SCREEN_WIDTH : 0, animated: true });
            setTimeout(() => { loadAllDays(newDate); setSelectedDate(newDate); }, 350);
        } else {
            setSelectedDate(newDate);
        }
    }

    return {
        selectedDate, carouselRef, chatBarVisible, setChatBarVisible,
        grouped, prevGrouped, nextGrouped, dailyGoals,
        editingEntry, setEditingEntry, editingRecipeGroup, setEditingRecipeGroup,
        portionInput, setPortionInput,
        selectionMode, selectedEntryIds, moveModalVisible, setMoveModalVisible,
        weightTrend, dayWeightLogs, meanWeightKg, weightDaysAgo, workoutRefreshKey,
        bumpWorkoutRefreshKey: () => setWorkoutRefreshKey((k) => k + 1),
        handleScrollEnd, handleDelete, handleDeleteRecipeLog,
        handleConfirmEntry, handleConfirmRecipeLog,
        handleAddWeight, handleDeleteWeight,
        handleEdit, handleEditRecipeGroup, handleSavePortionMultiplier,
        navigateToAdd, exitSelectionMode,
        handleToggleEntries, handleActivateSelection, handleActivateSelectionMultiple,
        handleMoveCopy, handleCreateRecipeFromSelection, handleDateChange,
        loadAllDays, SCREEN_WIDTH,
    };
}
