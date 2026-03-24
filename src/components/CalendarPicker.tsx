import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

interface CalendarPickerProps {
    visible: boolean;
    selectedDate: Date;
    onSelect: (date: Date) => void;
    onClose: () => void;
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
}: CalendarPickerProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

    // Reset view when opening
    React.useEffect(() => {
        if (visible) {
            setViewYear(selectedDate.getFullYear());
            setViewMonth(selectedDate.getMonth());
        }
    }, [visible, selectedDate]);

    const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
    const today = useMemo(() => new Date(), []);

    function prevMonth() {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    }

    function nextMonth() {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
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
                            {MONTH_NAMES[viewMonth]} {viewYear}
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
                        {DAY_LABELS.map((d) => (
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
                                            </Pressable>
                                        );
                                    })}
                            </View>
                        ),
                    )}

                    {/* Today button */}
                    <Pressable style={styles.todayButton} onPress={goToToday}>
                        <Text style={styles.todayButtonText}>Today</Text>
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
