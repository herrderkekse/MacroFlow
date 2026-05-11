// TODO: AiChatOverlay is an ai/components import from a log/screens file.
// Proper fix requires a shared overlay portal or moving rendering to the tab layout.
// Tracked in: https://github.com/BenniG82/macroflow/issues (search "AiChatOverlay boundary")
// eslint-disable-next-line boundaries/dependencies
import AiChatOverlay, { CHAT_BAR_TOTAL_HEIGHT } from "@/src/features/ai/components/AiChatOverlay";
// eslint-disable-next-line boundaries/dependencies
import WorkoutSummarySection from "@/src/features/exercise/components/WorkoutSummarySection";
// eslint-disable-next-line boundaries/dependencies
import AddExerciseModal from "@/src/features/exercise/components/AddExerciseModal";
import { addExerciseToWorkout, copySetsFromLastSession, createWorkout, finishWorkout, getWorkoutsByDate, type ExerciseTemplate } from "@/src/features/exercise/services/exerciseDb";
// eslint-disable-next-line boundaries/dependencies
import PhotoGallery from "@/src/features/photos/components/PhotoGallery";
import { listPhotosByDateWithRelations } from "@/src/features/photos/services/photoDb";
import type { Goals } from "@/src/features/settings/services/settingsDb";
import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import { formatDateKey, shiftCalendarDate } from "@/src/utils/date";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DailyProgressBar from "../components/DailyProgressBar";
import DateSelectorBar from "../components/DateSelectorBar";
import EntryModal from "../components/EntryModal";
import MealSection, { type RecipeGroup } from "../components/MealSection";
import MoveCopyModal from "../components/MoveCopyModal";
import WeightSection from "../components/WeightSection";
import { computeTotals, type EntryWithFood } from "../helpers/logHelpers";
import { useLogData } from "../hooks/useLogData";
import type { WeightLog } from "../services/logDb";

const SCREEN_WIDTH = Dimensions.get("window").width;

function PhotosSection({ dateKey, refreshKey }: { dateKey?: string; refreshKey?: number }) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [photos, setPhotos] = useState<ReturnType<typeof listPhotosByDateWithRelations>>([]);
    const [loading, setLoading] = useState(false);

    const loadPhotos = useCallback(() => {
        if (!dateKey) {
            setPhotos([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setPhotos(listPhotosByDateWithRelations(dateKey));
        setLoading(false);
    }, [dateKey]);

    useEffect(() => {
        loadPhotos();
    }, [loadPhotos, refreshKey]);

    function navigateToAddPhotos() {
        router.push({ pathname: "/photos/photos", params: dateKey ? { dateKey } : undefined });
    }

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Ionicons name="images-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.sectionHeaderLabel}>{t("log.photosTitle")}</Text>
                <Text style={styles.sectionCountLabel}>{t("log.photosLoggedCount", { count: photos.length })}</Text>
                <Pressable onPress={navigateToAddPhotos} hitSlop={8}>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.photosLoadingRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.photosLoadingText}>{t("log.photosLoading")}</Text>
                </View>
            ) : photos.length === 0 ? (
                <View style={styles.photosEmptyState}>
                    <Text style={styles.photosEmptyText}>{t("log.noPhotosLogged")}</Text>
                    <Button title={t("log.photosCta")} onPress={navigateToAddPhotos} />
                </View>
            ) : (
                <PhotoGallery photos={photos} emptyLabel={t("log.noPhotosLogged")} />
            )}
        </View>
    );
}

// ── DayPage ────────────────────────────────────────────────

function DayPage({
    grouped, goals, onAdd, onDelete, onEdit, onEditRecipeGroup, onDeleteRecipeLog,
    onConfirmEntry, onConfirmRecipeLog,
    selectionMode, selectedEntryIds, onToggleEntries, onActivateSelection, onActivateSelectionMultiple,
    meanWeightKg, weightTrend, weightDaysAgo, weightLogs, onAddWeight, onDeleteWeight,
    dateKey, onQuickAdd, workoutRefreshKey,
}: {
    grouped: Record<MealType, EntryWithFood[]>;
    goals: Goals;
    onAdd: (mt: MealType) => void;
    onDelete: (id: number) => void;
    onEdit: (row: EntryWithFood) => void;
    onEditRecipeGroup: (group: RecipeGroup, multiplier: number) => void;
    onDeleteRecipeLog: (recipeLogId: number) => void;
    onConfirmEntry?: (id: number) => void;
    onConfirmRecipeLog?: (recipeLogId: number) => void;
    selectionMode?: boolean;
    selectedEntryIds?: Set<number>;
    onToggleEntries?: (entryIds: number[]) => void;
    onActivateSelection?: (entryId: number) => void;
    onActivateSelectionMultiple?: (entryIds: number[]) => void;
    meanWeightKg?: number | null;
    weightTrend?: "up" | "down" | "flat" | null;
    weightDaysAgo?: number | null;
    weightLogs?: WeightLog[];
    onAddWeight?: (weightKg: number) => void;
    onDeleteWeight?: (id: number) => void;
    dateKey?: string;
    onQuickAdd?: () => void;
    workoutRefreshKey?: number;
}) {
    const totals = computeTotals(grouped);
    return (
        <View style={pageStyles.dayPage}>
            <ScrollView contentContainerStyle={pageStyles.content} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                <DailyProgressBar totals={totals} scheduledTotals={totals.scheduled} goals={goals} meanWeightKg={meanWeightKg} weightTrend={weightTrend} weightDaysAgo={weightDaysAgo} />
                {MEAL_TYPES.map((meal) => (
                    <MealSection
                        key={meal.key} mealType={meal.key} icon={meal.icon} items={grouped[meal.key]}
                        onAdd={() => onAdd(meal.key)} onDeleteEntry={onDelete} onEdit={onEdit}
                        onEditRecipeGroup={onEditRecipeGroup} onDeleteRecipeLog={onDeleteRecipeLog}
                        onConfirmEntry={onConfirmEntry} onConfirmRecipeLog={onConfirmRecipeLog}
                        selectionMode={selectionMode} selectedEntryIds={selectedEntryIds}
                        onToggleEntries={onToggleEntries} onActivateSelection={onActivateSelection}
                        onActivateSelectionMultiple={onActivateSelectionMultiple}
                    />
                ))}
                <WeightSection weights={weightLogs ?? []} onAdd={onAddWeight ?? (() => { })} onDelete={onDeleteWeight ?? (() => { })} />
                {dateKey && <WorkoutSummarySection date={dateKey} onQuickAdd={onQuickAdd} refreshKey={workoutRefreshKey} />}
                <PhotosSection dateKey={dateKey} refreshKey={workoutRefreshKey} />
            </ScrollView>
        </View>
    );
}

const pageStyles = StyleSheet.create({
    dayPage: { width: SCREEN_WIDTH },
    content: { padding: spacing.md, paddingBottom: 160 },
});

// ── Screen ─────────────────────────────────────────────────

export default function LogScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const d = useLogData();
    const [showAddExercise, setShowAddExercise] = useState(false);

    function handleQuickAddExercise(template: ExerciseTemplate, copyFromLast: boolean) {
        const dateKey = formatDateKey(d.selectedDate);
        const now = Date.now();
        const existing = getWorkoutsByDate(dateKey);
        let workoutId: number;
        let autoFinish = false;

        if (existing.length > 0 && !existing[0].ended_at) {
            workoutId = existing[0].id;
        } else {
            const w = createWorkout({ date: dateKey, started_at: now });
            workoutId = w.id;
            autoFinish = true;
        }

        const we = addExerciseToWorkout({ workout_id: workoutId, exercise_template_id: template.id });

        if (copyFromLast) {
            copySetsFromLastSession(template.id, we.id);
        }

        if (autoFinish) {
            finishWorkout(workoutId, now);
        }

        setShowAddExercise(false);
        d.bumpWorkoutRefreshKey();
    }

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.dateSelectorWrapper}>
                <DateSelectorBar date={d.selectedDate} onDateChange={d.handleDateChange} />
            </View>

            <ScrollView
                ref={d.carouselRef}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16} onMomentumScrollEnd={d.handleScrollEnd}
                contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
                style={styles.carousel} scrollEnabled={!d.selectionMode}
            >
                <DayPage grouped={d.prevGrouped} goals={d.dailyGoals} onAdd={d.navigateToAdd}
                    onDelete={d.handleDelete} onEdit={d.handleEdit} onEditRecipeGroup={d.handleEditRecipeGroup}
                    onDeleteRecipeLog={d.handleDeleteRecipeLog} onConfirmEntry={d.handleConfirmEntry}
                    onConfirmRecipeLog={d.handleConfirmRecipeLog}
                    meanWeightKg={d.meanWeightKg} weightTrend={d.weightTrend} weightDaysAgo={d.weightDaysAgo}
                    dateKey={formatDateKey(shiftCalendarDate(d.selectedDate, -1))}
                    workoutRefreshKey={d.workoutRefreshKey} />
                <DayPage grouped={d.grouped} goals={d.dailyGoals} onAdd={d.navigateToAdd}
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
                <DayPage grouped={d.nextGrouped} goals={d.dailyGoals} onAdd={d.navigateToAdd}
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

            <Pressable
                style={({ pressed }) => [styles.fab, { bottom: d.chatBarVisible ? CHAT_BAR_TOTAL_HEIGHT + 8 : 24 }, pressed && styles.fabPressed]}
                onPress={() => { if (d.selectionMode) d.setMoveModalVisible(true); else d.navigateToAdd(); }}
            >
                <Ionicons name={d.selectionMode ? "move-outline" : "add"} size={28} color="#fff" />
            </Pressable>


            <Modal visible={!!d.editingRecipeGroup} transparent animationType="fade" onRequestClose={() => d.setEditingRecipeGroup(null)}>
                <Pressable style={styles.overlay} onPress={() => d.setEditingRecipeGroup(null)}>
                    <Pressable style={styles.portionModal} onPress={() => { }}>
                        <Text style={styles.portionModalTitle}>{t("log.adjustPortions")}</Text>
                        <Text style={styles.portionModalSubtitle}>{d.editingRecipeGroup?.group.recipeName}</Text>
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
            position: "absolute", right: 24, width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
            elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25, shadowRadius: 4,
        },
        fabPressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
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
        photosLoadingRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.sm,
            paddingVertical: spacing.sm,
        },
        photosLoadingText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        photosEmptyState: {
            marginTop: spacing.sm,
            gap: spacing.sm,
        },
        photosEmptyText: {
            fontSize: fontSize.sm,
            color: colors.textTertiary,
        },
    });
}
