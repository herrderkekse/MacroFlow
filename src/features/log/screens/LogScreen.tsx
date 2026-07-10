// TODO: AiChatOverlay is an ai/components import from a log/screens file.
// Proper fix requires a shared overlay portal or moving rendering to the tab layout.
// Tracked in: https://github.com/BenniG82/macroflow/issues (search "AiChatOverlay boundary")
// eslint-disable-next-line boundaries/dependencies
import AiChatOverlay, { CHAT_BAR_TOTAL_HEIGHT } from "@/src/features/ai/components/AiChatOverlay";
// eslint-disable-next-line boundaries/dependencies
import AddExerciseModal from "@/src/features/exercise/components/AddExerciseModal";
import { addExerciseToWorkout, copySetsFromLastSession, createWorkout, finishWorkout, getExercisesForWorkout, getWorkoutsByDate, type ExerciseTemplate } from "@/src/features/exercise/services/exerciseDb";
import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { formatDateKey, shiftCalendarDate } from "@/src/utils/date";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateSelectorBar from "../components/DateSelectorBar";
import EntryModal from "../components/EntryModal";
import LogDayPage from "../components/LogDayPage";
import MoveCopyModal from "../components/MoveCopyModal";
import { useLogData } from "../hooks/useLogData";

const SCREEN_WIDTH = Dimensions.get("window").width;
const KG_TO_LB = 2.20462;

// ── Screen ─────────────────────────────────────────────────

export default function LogScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const unitSystem = useAppStore((s) => s.unitSystem);
    const isImperial = unitSystem === "imperial";
    const carouselRef = useRef<ScrollView>(null);
    const d = useLogData(carouselRef);
    const fabBottom = d.chatBarVisible ? CHAT_BAR_TOTAL_HEIGHT + 8 : 24;
    const quickActionBaseOffset = 72;
    const quickActionStep = 62;
    const [showAddExercise, setShowAddExercise] = useState(false);
    const [showQuickActions, setShowQuickActions] = useState(false);
    const [showWeightModal, setShowWeightModal] = useState(false);
    const [weightInput, setWeightInput] = useState("");
    const selectedDateKey = formatDateKey(d.selectedDate);

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

    function handleOpenFoodAdd() {
        setShowQuickActions(false);
        d.navigateToAdd();
    }

    function handleOpenWeightAdd() {
        setShowQuickActions(false);
        setShowWeightModal(true);
    }

    function handleOpenWorkoutAdd() {
        setShowQuickActions(false);
        router.push({ pathname: "/workout", params: { date: selectedDateKey } });
    }

    function handleOpenPhotosAdd() {
        setShowQuickActions(false);
        router.push({ pathname: "/photos/photos", params: { dateKey: selectedDateKey } });
    }

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

    function handleSaveWeight() {
        const value = parseFloat(weightInput);
        if (!value || value <= 0) return;
        const valueKg = isImperial ? value / KG_TO_LB : value;
        d.handleAddWeight(valueKg);
        setShowWeightModal(false);
        setWeightInput("");
    }

    const editingGroup = d.editingRecipeGroup?.group;

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.dateSelectorWrapper}>
                <DateSelectorBar date={d.selectedDate} onDateChange={d.handleDateChange} />
            </View>

            <ScrollView
                ref={carouselRef}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16} onMomentumScrollEnd={d.handleScrollEnd}
                contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
                style={styles.carousel} scrollEnabled={!d.selectionMode}
            >
                <LogDayPage width={SCREEN_WIDTH} grouped={d.prevGrouped} goals={d.prevGoals} onAdd={d.navigateToAdd}
                    onDelete={d.handleDelete} onEdit={d.handleEdit} onEditRecipeGroup={d.handleEditRecipeGroup}
                    onDeleteRecipeLog={d.handleDeleteRecipeLog} onConfirmEntry={d.handleConfirmEntry}
                    onConfirmRecipeLog={d.handleConfirmRecipeLog}
                    meanWeightKg={d.meanWeightKg} weightTrend={d.weightTrend} weightDaysAgo={d.weightDaysAgo}
                    dateKey={formatDateKey(shiftCalendarDate(d.selectedDate, -1))}
                    workoutRefreshKey={d.workoutRefreshKey} />
                <LogDayPage width={SCREEN_WIDTH} grouped={d.grouped} goals={d.dailyGoals} onAdd={d.navigateToAdd}
                    onDelete={d.handleDelete} onEdit={d.handleEdit} onEditRecipeGroup={d.handleEditRecipeGroup}
                    onDeleteRecipeLog={d.handleDeleteRecipeLog} onConfirmEntry={d.handleConfirmEntry}
                    onConfirmRecipeLog={d.handleConfirmRecipeLog}
                    selectionMode={d.selectionMode} selectedEntryIds={d.selectedEntryIds}
                    onToggleEntries={d.handleToggleEntries} onActivateSelection={d.handleActivateSelection}
                    onActivateSelectionMultiple={d.handleActivateSelectionMultiple}
                    meanWeightKg={d.meanWeightKg} weightTrend={d.weightTrend} weightDaysAgo={d.weightDaysAgo}
                    weightLogs={d.dayWeightLogs} onAddWeight={d.handleAddWeight} onDeleteWeight={d.handleDeleteWeight}
                    dateKey={formatDateKey(d.selectedDate)}
                    onQuickAdd={() => setShowAddExercise(true)}
                    workoutRefreshKey={d.workoutRefreshKey} />
                <LogDayPage width={SCREEN_WIDTH} grouped={d.nextGrouped} goals={d.nextGoals} onAdd={d.navigateToAdd}
                    onDelete={d.handleDelete} onEdit={d.handleEdit} onEditRecipeGroup={d.handleEditRecipeGroup}
                    onDeleteRecipeLog={d.handleDeleteRecipeLog} onConfirmEntry={d.handleConfirmEntry}
                    onConfirmRecipeLog={d.handleConfirmRecipeLog}
                    meanWeightKg={d.meanWeightKg} weightTrend={d.weightTrend} weightDaysAgo={d.weightDaysAgo}
                    dateKey={formatDateKey(shiftCalendarDate(d.selectedDate, +1))}
                    workoutRefreshKey={d.workoutRefreshKey} />
            </ScrollView>

            <EntryModal food={d.editingEntry?.foods ?? null} entry={d.editingEntry?.entries ?? null}
                onClose={() => d.setEditingEntry(null)}
                onSaved={() => { d.setEditingEntry(null); d.loadAllDays(d.selectedDate); }} />

            {d.selectionMode && (
                <>
                    <Pressable
                        style={({ pressed }) => [styles.secondaryFab, { bottom: fabBottom + 68 + 62 }, pressed && styles.secondaryFabPressed]}
                        onPress={handleDeleteSelection}
                    >
                        <Ionicons name="trash-outline" size={24} color={colors.danger} />
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.secondaryFab, { bottom: fabBottom + 68 }, pressed && styles.secondaryFabPressed]}
                        onPress={d.handleCreateRecipeFromSelection}
                    >
                        <Ionicons name="book-outline" size={24} color={colors.primary} />
                    </Pressable>
                </>
            )}

            {!d.selectionMode && showQuickActions && (
                <>
                    <Pressable
                        style={({ pressed }) => [styles.secondaryFab, styles.quickActionFab, { bottom: fabBottom + quickActionBaseOffset + quickActionStep * 3 }, pressed && styles.secondaryFabPressed]}
                        onPress={handleOpenPhotosAdd}
                    >
                        <Ionicons name="images-outline" size={22} color={colors.primary} />
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.secondaryFab, styles.quickActionFab, { bottom: fabBottom + quickActionBaseOffset + quickActionStep * 2 }, pressed && styles.secondaryFabPressed]}
                        onPress={handleOpenWorkoutAdd}
                    >
                        <Ionicons name="barbell-outline" size={22} color={colors.primary} />
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.secondaryFab, styles.quickActionFab, { bottom: fabBottom + quickActionBaseOffset + quickActionStep }, pressed && styles.secondaryFabPressed]}
                        onPress={handleOpenWeightAdd}
                    >
                        <Ionicons name="scale-outline" size={22} color={colors.primary} />
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.secondaryFab, styles.quickActionFab, { bottom: fabBottom + quickActionBaseOffset }, pressed && styles.secondaryFabPressed]}
                        onPress={handleOpenFoodAdd}
                    >
                        <Ionicons name="fast-food-outline" size={22} color={colors.primary} />
                    </Pressable>
                </>
            )}

            <Pressable
                style={({ pressed }) => [styles.fab, { bottom: fabBottom }, pressed && styles.fabPressed]}
                onPress={() => {
                    if (d.selectionMode) {
                        d.setMoveModalVisible(true);
                        return;
                    }
                    setShowQuickActions((prev) => !prev);
                }}
            >
                <Ionicons name={d.selectionMode ? "move-outline" : showQuickActions ? "close" : "add"} size={32} color="#fff" />
            </Pressable>

            <Modal visible={showWeightModal} transparent animationType="fade" onRequestClose={() => setShowWeightModal(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowWeightModal(false)}>
                    <Pressable style={styles.portionModal} onPress={() => { }}>
                        <Text style={styles.portionModalTitle}>{t("log.logWeight")}</Text>
                        <Input
                            value={weightInput}
                            onChangeText={setWeightInput}
                            keyboardType="decimal-pad"
                            placeholder={isImperial ? "lb" : "kg"}
                            containerStyle={{ marginBottom: spacing.md }}
                            autoFocus
                        />
                        <Button title={t("common.save")} onPress={handleSaveWeight} />
                    </Pressable>
                </Pressable>
            </Modal>


            <Modal visible={!!d.editingRecipeGroup} transparent animationType="fade" onRequestClose={() => d.setEditingRecipeGroup(null)}>
                <Pressable style={styles.overlay} onPress={() => d.setEditingRecipeGroup(null)}>
                    <Pressable style={styles.portionModal} onPress={() => { }}>
                        <Text style={styles.portionModalTitle}>{t("log.adjustPortions")}</Text>
                        <Text style={styles.portionModalSubtitle}>{[editingGroup?.recipeName, editingGroup?.recipeVariant].filter(Boolean).join(" · ")}</Text>
                        <View style={styles.portionRow}>
                            <Pressable
                                onPress={() => { const v = Math.max(0.25, (parseFloat(d.portionInput) || 1) - 0.25); d.setPortionInput(String(Math.round(v * 100) / 100)); }}
                                style={styles.portionBtn}
                            >
                                <Ionicons name="remove" size={20} color={colors.primary} />
                            </Pressable>
                            <Input value={d.portionInput} onChangeText={d.setPortionInput} keyboardType="decimal-pad"
                                containerStyle={styles.portionInputContainer} style={styles.portionInputText} />
                            <Pressable
                                onPress={() => { const v = (parseFloat(d.portionInput) || 1) + 0.25; d.setPortionInput(String(Math.round(v * 100) / 100)); }}
                                style={styles.portionBtn}
                            >
                                <Ionicons name="add" size={20} color={colors.primary} />
                            </Pressable>
                        </View>
                        <Button title={t("common.save")} onPress={d.handleSavePortionMultiplier} />
                    </Pressable>
                </Pressable>
            </Modal>

            <MoveCopyModal visible={d.moveModalVisible} onClose={() => d.setMoveModalVisible(false)}
                onConfirm={d.handleMoveCopy} initialDate={d.selectedDate}
                selectedEntries={Object.values(d.grouped).flat().filter(e => d.selectedEntryIds.has(e.entries.id))} />

            <AiChatOverlay tabBarHeight={tabBarHeight} onVisibilityChange={d.setChatBarVisible}
                onDataChanged={() => d.loadAllDays(d.selectedDate)} />

            <AddExerciseModal
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
        dateSelectorWrapper: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
        carousel: { flex: 1 },
        fab: {
            position: "absolute", right: 20, width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
            elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25, shadowRadius: 4,
        },
        fabPressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
        secondaryFab: {
            position: "absolute", right: 24, width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: colors.border,
            elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2, shadowRadius: 3,
        },
        quickActionFab: {
            zIndex: 5,
            width: 48,
            height: 48,
            borderRadius: 24,
            right: 28,
        },
        secondaryFabPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
        portionModal: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, width: "100%", maxWidth: 340 },
        portionModalTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
        portionModalSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
        portionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
        portionBtn: {
            width: 40, height: 40, borderRadius: borderRadius.sm, backgroundColor: colors.background,
            borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
        },
        portionInputContainer: { flex: 1, marginBottom: 0 },
        portionInputText: { textAlign: "center", fontSize: fontSize.lg, fontWeight: "700" },
        sectionContainer: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        sectionHeaderLabel: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        sectionCountLabel: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
        },
    });
}
