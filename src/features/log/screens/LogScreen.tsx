// TODO: AiChatOverlay is an ai/components import from a log/screens file.
// Proper fix requires a shared overlay portal or moving rendering to the tab layout.
// Tracked in: https://github.com/BenniG82/macroflow/issues (search "AiChatOverlay boundary")
// eslint-disable-next-line boundaries/dependencies
import AiChatOverlay, { CHAT_BAR_TOTAL_HEIGHT } from "@/src/features/ai/components/AiChatOverlay";
// eslint-disable-next-line boundaries/dependencies
import WorkoutSummarySection from "@/src/features/exercise/components/WorkoutSummarySection";
import type { Goals } from "@/src/features/settings/services/settingsDb";
import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { formatDateKey, shiftCalendarDate } from "@/src/utils/date";

const SCREEN_WIDTH = Dimensions.get("window").width;

// ── DayPage ────────────────────────────────────────────────

function DayPage({
    grouped, goals, onAdd, onDelete, onEdit, onEditRecipeGroup, onDeleteRecipeLog,
    onConfirmEntry, onConfirmRecipeLog,
    selectionMode, selectedEntryIds, onToggleEntries, onActivateSelection, onActivateSelectionMultiple,
    meanWeightKg, weightTrend, weightDaysAgo, weightLogs, onAddWeight, onDeleteWeight,
    dateKey,
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
                {dateKey && <WorkoutSummarySection date={dateKey} />}
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
                    dateKey={formatDateKey(shiftCalendarDate(d.selectedDate, -1))} />
                <DayPage grouped={d.grouped} goals={d.dailyGoals} onAdd={d.navigateToAdd}
                    onDelete={d.handleDelete} onEdit={d.handleEdit} onEditRecipeGroup={d.handleEditRecipeGroup}
                    onDeleteRecipeLog={d.handleDeleteRecipeLog} onConfirmEntry={d.handleConfirmEntry}
                    onConfirmRecipeLog={d.handleConfirmRecipeLog}
                    selectionMode={d.selectionMode} selectedEntryIds={d.selectedEntryIds}
                    onToggleEntries={d.handleToggleEntries} onActivateSelection={d.handleActivateSelection}
                    onActivateSelectionMultiple={d.handleActivateSelectionMultiple}
                    meanWeightKg={d.meanWeightKg} weightTrend={d.weightTrend} weightDaysAgo={d.weightDaysAgo}
                    weightLogs={d.dayWeightLogs} onAddWeight={d.handleAddWeight} onDeleteWeight={d.handleDeleteWeight}
                    dateKey={formatDateKey(d.selectedDate)} />
                <DayPage grouped={d.nextGrouped} goals={d.dailyGoals} onAdd={d.navigateToAdd}
                    onDelete={d.handleDelete} onEdit={d.handleEdit} onEditRecipeGroup={d.handleEditRecipeGroup}
                    onDeleteRecipeLog={d.handleDeleteRecipeLog} onConfirmEntry={d.handleConfirmEntry}
                    onConfirmRecipeLog={d.handleConfirmRecipeLog}
                    meanWeightKg={d.meanWeightKg} weightTrend={d.weightTrend} weightDaysAgo={d.weightDaysAgo}
                    dateKey={formatDateKey(shiftCalendarDate(d.selectedDate, +1))} />
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

            {!d.selectionMode && (
                <Pressable
                    style={({ pressed }) => [styles.fabSecondary, { bottom: d.chatBarVisible ? CHAT_BAR_TOTAL_HEIGHT + 8 : 24 }, pressed && styles.fabPressed]}
                    onPress={d.navigateToWorkout}
                >
                    <Ionicons name="barbell-outline" size={24} color="#fff" />
                </Pressable>
            )}

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
                onConfirm={d.handleMoveCopy} initialDate={d.selectedDate} />

            <AiChatOverlay tabBarHeight={tabBarHeight} onVisibilityChange={d.setChatBarVisible}
                onDataChanged={() => d.loadAllDays(d.selectedDate)} />
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
        fabSecondary: {
            position: "absolute", right: 92, width: 48, height: 48, borderRadius: 24,
            backgroundColor: colors.weight, alignItems: "center", justifyContent: "center",
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
    });
}
