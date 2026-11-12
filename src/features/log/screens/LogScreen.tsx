// TODO: AiChatOverlay is an ai/components import from a log/screens file.
// Proper fix requires a shared overlay portal or moving rendering to the tab layout.
// Tracked in: https://github.com/BenniG82/macroflow/issues (search "AiChatOverlay boundary")
// eslint-disable-next-line boundaries/dependencies
import AiChatOverlay, { CHAT_BAR_TOTAL_HEIGHT } from "@/src/features/ai/components/AiChatOverlay";
// eslint-disable-next-line boundaries/dependencies
import AddExerciseSheet from "@/src/features/exercise/components/AddExerciseSheet";
import { addExerciseToWorkout, copySetsFromLastSession, createWorkout, finishWorkout, getExercisesForWorkout, getWorkoutsByDate, type ExerciseTemplate } from "@/src/features/exercise/services/exerciseDb";
import { isShareConfigured, shareLogSelection } from "@/src/features/share/services/shareService";
import Fab from "@/src/shared/atoms/Fab";
import ActionSheet, { type ActionSheetItem } from "@/src/shared/components/ActionSheet";
import ShareSheet from "@/src/shared/components/ShareSheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { formatDateKey, shiftCalendarDate } from "@/src/utils/date";
import { spacing, type ThemeColors } from "@/src/utils/theme";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, Dimensions, ScrollView, StyleSheet, View } from "react-native";
import EntrySheet from "../components/EntrySheet";
import LogDayPage from "../components/LogDayPage";
import LogHeader from "../components/LogHeader";
import MoveCopySheet from "../components/MoveCopySheet";
import PortionSheet from "../components/PortionSheet";
import SelectionBar from "../components/SelectionBar";
import WeightSheet from "../components/WeightSheet";
import { useLogData } from "../hooks/useLogData";

const SCREEN_WIDTH = Dimensions.get("window").width;

// ── Screen ─────────────────────────────────────────────────

export default function LogScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const tabBarHeight = useBottomTabBarHeight();
    const carouselRef = useRef<ScrollView>(null);
    const d = useLogData(carouselRef);
    const floatingBottom = (d.chatBarVisible ? CHAT_BAR_TOTAL_HEIGHT : 0) + spacing.md;
    const [showAddExercise, setShowAddExercise] = useState(false);
    const [showQuickActions, setShowQuickActions] = useState(false);
    const [showWeightModal, setShowWeightModal] = useState(false);
    const [shareAvailable, setShareAvailable] = useState(false);
    const [shareVisible, setShareVisible] = useState(false);
    const selectedDateKey = formatDateKey(d.selectedDate);

    // Re-checked on focus so signing in under Account and coming back
    // immediately enables the share action.
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            isShareConfigured().then((available) => {
                if (!cancelled) setShareAvailable(available);
            });
            return () => {
                cancelled = true;
            };
        }, []),
    );

    // While entries are selected, the system back button leaves selection
    // mode instead of leaving the app.
    const { selectionMode, exitSelectionMode } = d;
    useFocusEffect(
        useCallback(() => {
            if (!selectionMode) return;
            const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
                exitSelectionMode();
                return true;
            });
            return () => subscription.remove();
        }, [selectionMode, exitSelectionMode]),
    );

    function handleShareSelection() {
        if (!shareAvailable) {
            Alert.alert(t("share.notConfiguredTitle"), t("share.notConfiguredMessage"));
            return;
        }
        setShareVisible(true);
    }

    function handleQuickAddExercise(template: ExerciseTemplate, copyFromLast: boolean) {
        const now = Date.now();
        const existing = getWorkoutsByDate(selectedDateKey);
        let workoutId: number;
        let autoFinish = false;

        if (existing.length > 0 && !existing[0].ended_at) {
            workoutId = existing[0].id;
        } else {
            const w = createWorkout({ date: selectedDateKey, started_at: now });
            workoutId = w.id;
            autoFinish = true;
        }

        const sortOrder = getExercisesForWorkout(workoutId).length + 1;
        const we = addExerciseToWorkout({ workout_id: workoutId, exercise_template_id: template.id, sort_order: sortOrder });

        if (copyFromLast) {
            copySetsFromLastSession(template.id, we.id);
        }

        if (autoFinish) {
            finishWorkout(workoutId, now);
        }

        setShowAddExercise(false);
        d.bumpWorkoutRefreshKey();
    }

    const addActions: ActionSheetItem[] = [
        { key: "food", icon: "restaurant-outline", label: t("log.addFood"), onPress: () => d.navigateToAdd() },
        { key: "weight", icon: "scale-outline", label: t("log.addWeight"), onPress: () => setShowWeightModal(true) },
        {
            key: "workout",
            icon: "barbell-outline",
            label: t("log.addWorkout"),
            onPress: () => router.push({ pathname: "/workout", params: { date: selectedDateKey } }),
        },
        {
            key: "photos",
            icon: "images-outline",
            label: t("log.addPhotos"),
            onPress: () => router.push({ pathname: "/photos/photos", params: { dateKey: selectedDateKey } }),
        },
    ];

    function handleDeleteSelection() {
        Alert.alert(
            t("log.deleteSelectedTitle", { count: d.selectedEntryIds.size }),
            t("log.deleteSelectedMessage"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: d.handleDeleteSelection },
            ],
        );
    }

    function handleDeleteEditingEntry() {
        const id = d.editingEntry?.entries.id;
        d.setEditingEntry(null);
        if (id != null) d.handleDelete(id);
    }

    const editingGroup = d.editingRecipeGroup?.group;
    const dayPageProps = {
        width: SCREEN_WIDTH,
        onAdd: d.navigateToAdd,
        onEdit: d.handleEdit,
        onEditRecipeGroup: d.handleEditRecipeGroup,
        onDeleteRecipeLog: d.handleDeleteRecipeLog,
        onConfirmEntry: d.handleConfirmEntry,
        onConfirmRecipeLog: d.handleConfirmRecipeLog,
        meanWeightKg: d.meanWeightKg,
        weightTrend: d.weightTrend,
        weightDaysAgo: d.weightDaysAgo,
        workoutRefreshKey: d.workoutRefreshKey,
    };

    return (
        <View style={styles.screen}>
            <LogHeader date={d.selectedDate} onDateChange={d.handleDateChange} />

            <ScrollView
                ref={carouselRef}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16} onMomentumScrollEnd={d.handleScrollEnd}
                contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
                style={styles.carousel} scrollEnabled={!d.selectionMode}
            >
                <LogDayPage {...dayPageProps} grouped={d.prevGrouped} goals={d.prevGoals}
                    dateKey={formatDateKey(shiftCalendarDate(d.selectedDate, -1))} />
                <LogDayPage {...dayPageProps} grouped={d.grouped} goals={d.dailyGoals}
                    selectionMode={d.selectionMode} selectedEntryIds={d.selectedEntryIds}
                    onToggleEntries={d.handleToggleEntries} onActivateSelection={d.handleActivateSelection}
                    onActivateSelectionMultiple={d.handleActivateSelectionMultiple}
                    weightLogs={d.dayWeightLogs} onAddWeight={d.handleAddWeight} onDeleteWeight={d.handleDeleteWeight}
                    dateKey={selectedDateKey}
                    onQuickAdd={() => setShowAddExercise(true)} />
                <LogDayPage {...dayPageProps} grouped={d.nextGrouped} goals={d.nextGoals}
                    dateKey={formatDateKey(shiftCalendarDate(d.selectedDate, +1))} />
            </ScrollView>

            {d.selectionMode ? (
                <SelectionBar
                    count={d.selectedEntryIds.size}
                    bottom={floatingBottom}
                    onDone={d.exitSelectionMode}
                    actions={[
                        { key: "move", icon: "swap-horizontal-outline", label: t("log.actionMoveCopy"), onPress: () => d.setMoveModalVisible(true) },
                        { key: "recipe", icon: "book-outline", label: t("log.actionSaveRecipe"), onPress: d.handleCreateRecipeFromSelection },
                        { key: "share", icon: "share-outline", label: t("common.share"), onPress: handleShareSelection, dimmed: !shareAvailable },
                        { key: "delete", icon: "trash-outline", label: t("common.delete"), onPress: handleDeleteSelection, destructive: true },
                    ]}
                />
            ) : (
                <Fab label={t("log.addToDay")} bottom={floatingBottom} onPress={() => setShowQuickActions(true)} />
            )}

            <ActionSheet
                visible={showQuickActions}
                onClose={() => setShowQuickActions(false)}
                title={t("log.addToDay")}
                actions={addActions}
            />

            <EntrySheet food={d.editingEntry?.foods ?? null} entry={d.editingEntry?.entries ?? null}
                onClose={() => d.setEditingEntry(null)}
                onDelete={handleDeleteEditingEntry}
                onSaved={() => { d.setEditingEntry(null); d.loadAllDays(d.selectedDate); }} />

            <WeightSheet visible={showWeightModal} onClose={() => setShowWeightModal(false)} onSave={d.handleAddWeight} />

            <PortionSheet
                visible={!!d.editingRecipeGroup}
                recipeName={[editingGroup?.recipeName, editingGroup?.recipeVariant].filter(Boolean).join(" · ")}
                value={d.portionInput}
                onChangeValue={d.setPortionInput}
                onSave={d.handleSavePortionMultiplier}
                onClose={() => d.setEditingRecipeGroup(null)}
            />

            <MoveCopySheet visible={d.moveModalVisible} onClose={() => d.setMoveModalVisible(false)}
                onConfirm={d.handleMoveCopy} initialDate={d.selectedDate}
                selectedEntries={Object.values(d.grouped).flat().filter(e => d.selectedEntryIds.has(e.entries.id))} />

            <ShareSheet
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                fetchUrl={() => shareLogSelection(Object.values(d.grouped).flat(), d.selectedEntryIds)}
            />

            <AiChatOverlay tabBarHeight={tabBarHeight} onVisibilityChange={d.setChatBarVisible}
                onDataChanged={() => d.loadAllDays(d.selectedDate)} />

            <AddExerciseSheet
                visible={showAddExercise}
                onClose={() => setShowAddExercise(false)}
                onSelect={handleQuickAddExercise}
            />
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        carousel: { flex: 1 },
    });
}
