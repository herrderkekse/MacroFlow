import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { formatDateKey } from "@/src/utils/date";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface CalendarPickerProps {
    visible: boolean;
    selectedDate: Date;
    onSelect: (date: Date) => void;
    onClose: () => void;
    dayCategoryColors?: Record<string, string[]>;
    onViewMonthChange?: (year: number, month: number) => void;
}

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function getMonthGrid(year: number, month: number) {
    const first = new Date(year, month, 1);
    // Monday = 0, Sunday = 6
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

export default function CalendarPicker({
    visible,
    selectedDate,
    onSelect,
    onClose,
    dayCategoryColors,
    onViewMonthChange,
}: CalendarPickerProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t, i18n } = useTranslation();
    const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

    // Reset view when opening
    React.useEffect(() => {
        if (visible) {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth();
            setViewYear(year);
            setViewMonth(month);
            onViewMonthChange?.(year, month);
        }
    }, [onViewMonthChange, selectedDate, visible]);

    const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
    const today = useMemo(() => new Date(), []);
    const weekdayLabels = useMemo(() => {
        const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
        const monday = new Date(2024, 0, 1);
        return Array.from({ length: 7 }, (_, index) => {
            const day = new Date(monday);
            day.setDate(monday.getDate() + index);
            return formatter.format(day);
        });
    }, [i18n.language]);
    const monthTitle = useMemo(() => {
        const formatter = new Intl.DateTimeFormat(i18n.language, { month: "long" });
        return `${formatter.format(new Date(viewYear, viewMonth, 1))} ${viewYear}`;
    }, [i18n.language, viewMonth, viewYear]);

    function prevMonth() {
        if (viewMonth === 0) {
            const nextYear = viewYear - 1;
            setViewMonth(11);
            setViewYear(nextYear);
            onViewMonthChange?.(nextYear, 11);
        } else {
            const nextMonth = viewMonth - 1;
            setViewMonth(nextMonth);
            onViewMonthChange?.(viewYear, nextMonth);
        }
    }

    function nextMonth() {
        if (viewMonth === 11) {
            const nextYear = viewYear + 1;
            setViewMonth(0);
            setViewYear(nextYear);
            onViewMonthChange?.(nextYear, 0);
        } else {
            const nextMonth = viewMonth + 1;
            setViewMonth(nextMonth);
            onViewMonthChange?.(viewYear, nextMonth);
        }
    }

    function selectDay(day: number) {
        onSelect(new Date(viewYear, viewMonth, day));
    }

    function goToToday() {
        const now = new Date();
        onSelect(now);
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.card} onPress={() => { }}>
                    {/* Month/year header */}
                    <View style={styles.header}>
                        <Pressable onPress={prevMonth} hitSlop={12}>
                            <Ionicons
                                name="chevron-back"
                                size={22}
                                color={colors.text}
                            />
                        </Pressable>
                        <Text style={styles.monthTitle}>
                            {monthTitle}
                        </Text>
                        <Pressable onPress={nextMonth} hitSlop={12}>
                            <Ionicons
                                name="chevron-forward"
                                size={22}
                                color={colors.text}
                            />
                        </Pressable>
                    </View>

                    {/* Day-of-week labels */}
                    <View style={styles.row}>
                        {weekdayLabels.map((d) => (
                            <View key={d} style={styles.cell}>
                                <Text style={styles.dayLabel}>{d}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Day grid */}
                    {Array.from(
                        { length: cells.length / 7 },
                        (_, weekIdx) => (
                            <View key={weekIdx} style={styles.row}>
                                {cells
                                    .slice(weekIdx * 7, weekIdx * 7 + 7)
                                    .map((day, cellIdx) => {
                                        if (day === null) {
                                            return (
                                                <View
                                                    key={cellIdx}
                                                    style={styles.cell}
                                                />
                                            );
                                        }
                                        const cellDate = new Date(
                                            viewYear,
                                            viewMonth,
                                            day,
                                        );
                                        const isSelected = isSameDay(
                                            cellDate,
                                            selectedDate,
                                        );
                                        const isToday = isSameDay(
                                            cellDate,
                                            today,
                                        );
                                        const markerColors =
                                            dayCategoryColors?.[formatDateKey(cellDate)] ?? [];
                                        return (
                                            <Pressable
                                                key={cellIdx}
                                                style={[
                                                    styles.cell,
                                                    isSelected &&
                                                    styles.selectedCell,
                                                ]}
                                                onPress={() => selectDay(day)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.dayText,
                                                        isToday &&
                                                        styles.todayText,
                                                        isSelected &&
                                                        styles.selectedText,
                                                    ]}
                                                >
                                                    {day}
                                                </Text>
                                                {markerColors.length > 0 ? (
                                                    <View style={styles.markerRow}>
                                                        {markerColors.slice(0, 4).map((markerColor, index) => (
                                                            <View
                                                                key={index}
                                                                style={[styles.markerDot, { backgroundColor: markerColor }]}
                                                            />
                                                        ))}
                                                    </View>
                                                ) : null}
                                            </Pressable>
                                        );
                                    })}
                            </View>
                        ),
                    )}

                    {/* Today button */}
                    <Pressable style={styles.todayButton} onPress={goToToday}>
                        <Text style={styles.todayButtonText}>{t("log.today")}</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const CELL_SIZE = 40;

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            alignItems: "center",
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            width: CELL_SIZE * 7 + spacing.md * 2,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
        },
        monthTitle: {
            fontSize: fontSize.lg,
            fontWeight: "600",
            color: colors.text,
        },
        row: {
            flexDirection: "row",
        },
        cell: {
            width: CELL_SIZE,
            height: CELL_SIZE,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: CELL_SIZE / 2,
        },
        dayLabel: {
            fontSize: fontSize.xs,
            fontWeight: "500",
            color: colors.textTertiary,
        },
        dayText: {
            fontSize: fontSize.sm,
            color: colors.text,
        },
        todayText: {
            color: colors.primary,
            fontWeight: "700",
        },
        selectedCell: {
            backgroundColor: colors.primary,
        },
        selectedText: {
            color: "#fff",
            fontWeight: "700",
        },
        markerRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            marginTop: 1,
        },
        markerDot: {
            width: 4,
            height: 4,
            borderRadius: 2,
        },
        todayButton: {
            alignSelf: "center",
            marginTop: spacing.sm,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.md,
        },
        todayButtonText: {
            fontSize: fontSize.sm,
            color: colors.primary,
            fontWeight: "600",
        },
    });
}
