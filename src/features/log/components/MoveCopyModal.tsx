import Button from "@/src/shared/atoms/Button";
import CalendarPicker from "@/src/shared/components/CalendarPicker";
import { MEAL_TYPES } from "@/src/shared/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatDateKey, getLoggedRecipeGroups, type EntryWithFood, type LoggedRecipeGroup } from "../services/logDb";

interface MoveCopyModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (targetDate: Date, targetMealType: string | null, action: "move" | "copy", targetRecipeLogId: number | null) => void;
    initialDate: Date;
    selectedEntries?: EntryWithFood[];
}

export default function MoveCopyModal({
    visible,
    onClose,
    onConfirm,
    initialDate,
    selectedEntries = [],
}: MoveCopyModalProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [targetDate, setTargetDate] = useState(initialDate);
    const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
    const [selectedRecipeLogId, setSelectedRecipeLogId] = useState<number | null>(null);
    const [calendarVisible, setCalendarVisible] = useState(false);

    // Derive scheduling status of selected entries
    const anyScheduled = selectedEntries.some((e) => e.entries.is_scheduled === 1);
    const anyUnscheduled = selectedEntries.some((e) => e.entries.is_scheduled !== 1);

    // Load recipe groups for the currently selected date+meal
    const recipeGroups: LoggedRecipeGroup[] = useMemo(() => {
        if (!selectedMeal) return [];
        const dateKey = formatDateKey(targetDate);
        return getLoggedRecipeGroups(dateKey, selectedMeal);
    }, [targetDate, selectedMeal]);

    React.useEffect(() => {
        if (visible) {
            setTargetDate(initialDate);
            setSelectedMeal(null);
            setSelectedRecipeLogId(null);
        }
    }, [visible, initialDate]);

    // Reset recipe selection when meal or date changes
    React.useEffect(() => {
        setSelectedRecipeLogId(null);
    }, [selectedMeal, targetDate]);

    function shiftDate(days: number) {
        setTargetDate((prev) => {
            const d = new Date(prev);
            d.setDate(d.getDate() + days);
            return d;
        });
    }

    function getDateLabel(date: Date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const isSameDay = (a: Date, b: Date) =>
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();

        if (isSameDay(date, today)) return t("log.today");
        if (isSameDay(date, tomorrow)) return t("log.tomorrow");
        if (isSameDay(date, yesterday)) return t("log.yesterday");
        return date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    }

    function isRecipeDisabled(recipe: LoggedRecipeGroup): boolean {
        if (recipe.isScheduled && anyUnscheduled) return true;
        if (!recipe.isScheduled && anyScheduled) return true;
        return false;
    }

    const dateLabel = getDateLabel(targetDate);

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={onClose}
            >
                <Pressable style={styles.overlay} onPress={onClose}>
                    <Pressable style={styles.modal} onPress={() => {}}>
                        <Text style={styles.title}>{t("log.moveCopyTitle")}</Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Date selector */}
                        <Text style={styles.sectionLabel}>{t("log.selectDate")}</Text>
                        <View style={styles.dateRow}>
                            <Pressable onPress={() => shiftDate(-1)} hitSlop={8}>
                                <Ionicons
                                    name="chevron-back"
                                    size={22}
                                    color={colors.text}
                                />
                            </Pressable>
                            <Pressable
                                onPress={() => setCalendarVisible(true)}
                                style={styles.dateDisplay}
                            >
                                <Text style={styles.dateText}>{dateLabel}</Text>
                                <Ionicons
                                    name="calendar-outline"
                                    size={18}
                                    color={colors.primary}
                                />
                            </Pressable>
                            <Pressable onPress={() => shiftDate(1)} hitSlop={8}>
                                <Ionicons
                                    name="chevron-forward"
                                    size={22}
                                    color={colors.text}
                                />
                            </Pressable>
                        </View>

                        {/* Meal selector */}
                        <Text style={styles.sectionLabel}>{t("log.selectMeal")}</Text>
                        <View style={styles.mealOptions}>
                            <Pressable
                                style={[
                                    styles.mealOption,
                                    selectedMeal === null && styles.mealOptionSelected,
                                ]}
                                onPress={() => setSelectedMeal(null)}
                            >
                                <Ionicons
                                    name="swap-horizontal-outline"
                                    size={16}
                                    color={selectedMeal === null ? "#fff" : colors.text}
                                />
                                <Text
                                    style={[
                                        styles.mealOptionText,
                                        selectedMeal === null && styles.mealOptionTextSelected,
                                    ]}
                                >
                                    {t("log.keepMeal")}
                                </Text>
                            </Pressable>
                            {MEAL_TYPES.map((meal) => (
                                <Pressable
                                    key={meal.key}
                                    style={[
                                        styles.mealOption,
                                        selectedMeal === meal.key && styles.mealOptionSelected,
                                    ]}
                                    onPress={() => setSelectedMeal(meal.key)}
                                >
                                    <Ionicons
                                        name={meal.icon as never}
                                        size={16}
                                        color={selectedMeal === meal.key ? "#fff" : colors.text}
                                    />
                                    <Text
                                        style={[
                                            styles.mealOptionText,
                                            selectedMeal === meal.key && styles.mealOptionTextSelected,
                                        ]}
                                    >
                                        {t(`meal.${meal.key}`)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Recipe selector — only shown when a specific meal is selected and it has recipes */}
                        {selectedMeal !== null && recipeGroups.length > 0 && (
                            <>
                                <Text style={styles.sectionLabel}>{t("log.selectRecipe")}</Text>
                                <View style={styles.mealOptions}>
                                    <Pressable
                                        style={[
                                            styles.mealOption,
                                            selectedRecipeLogId === null && styles.mealOptionSelected,
                                        ]}
                                        onPress={() => setSelectedRecipeLogId(null)}
                                    >
                                        <Ionicons
                                            name="remove-circle-outline"
                                            size={16}
                                            color={selectedRecipeLogId === null ? "#fff" : colors.text}
                                        />
                                        <Text
                                            style={[
                                                styles.mealOptionText,
                                                selectedRecipeLogId === null && styles.mealOptionTextSelected,
                                            ]}
                                        >
                                            {t("log.noRecipe")}
                                        </Text>
                                    </Pressable>
                                    {recipeGroups.map((recipe) => {
                                        const disabled = isRecipeDisabled(recipe);
                                        const isSelected = selectedRecipeLogId === recipe.recipeLogId;
                                        return (
                                            <Pressable
                                                key={recipe.recipeLogId}
                                                style={[
                                                    styles.mealOption,
                                                    isSelected && styles.mealOptionSelected,
                                                    disabled && styles.mealOptionDisabled,
                                                ]}
                                                onPress={() => {
                                                    if (!disabled) {
                                                        setSelectedRecipeLogId(isSelected ? null : recipe.recipeLogId);
                                                    }
                                                }}
                                            >
                                                <Ionicons
                                                    name="book-outline"
                                                    size={16}
                                                    color={isSelected ? "#fff" : disabled ? colors.textTertiary : colors.text}
                                                />
                                                <Text
                                                    style={[
                                                        styles.mealOptionText,
                                                        isSelected && styles.mealOptionTextSelected,
                                                        disabled && styles.mealOptionTextDisabled,
                                                    ]}
                                                >
                                                    {recipe.recipeName}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        {/* Action buttons */}
                        <View style={styles.actions}>
                            <Button
                                title={t("log.move")}
                                onPress={() => onConfirm(targetDate, selectedMeal, "move", selectedRecipeLogId)}
                                style={{ flex: 1 }}
                            />
                            <Button
                                title={t("log.copy")}
                                variant="outline"
                                onPress={() => onConfirm(targetDate, selectedMeal, "copy", selectedRecipeLogId)}
                                style={{ flex: 1 }}
                            />
                        </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            <CalendarPicker
                visible={calendarVisible}
                selectedDate={targetDate}
                onSelect={(date) => {
                    setTargetDate(date);
                    setCalendarVisible(false);
                }}
                onClose={() => setCalendarVisible(false)}
            />
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        modal: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            width: "100%",
            maxWidth: 360,
            maxHeight: "85%",
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.md,
        },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
        },
        dateRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
        },
        dateDisplay: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.background,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        dateText: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
        },
        mealOptions: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        mealOption: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        mealOptionSelected: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        mealOptionText: {
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.text,
        },
        mealOptionTextSelected: {
            color: "#fff",
        },
        mealOptionDisabled: {
            opacity: 0.4,
        },
        mealOptionTextDisabled: {
            color: colors.textTertiary,
        },
        actions: {
            flexDirection: "row",
            gap: spacing.sm,
        },
    });
}
