import Button from "@/src/shared/atoms/Button";
import IconButton from "@/src/shared/atoms/IconButton";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { formatDateKey } from "@/src/utils/date";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
            queueMicrotask(() => {
                setViewYear(year);
                setViewMonth(month);
            });
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
        <Sheet
            visible={visible}
            onClose={onClose}
            title={monthTitle}
            headerRight={
                <>
                    <IconButton icon="chevron-back" size="sm" label={t("calendar.previousMonth")} onPress={prevMonth} />
                    <IconButton icon="chevron-forward" size="sm" label={t("calendar.nextMonth")} onPress={nextMonth} />
                </>
            }
            footer={<Button title={t("log.today")} variant="outline" onPress={goToToday} />}
            scrollable={false}
        >
            <View style={styles.row}>
                {weekdayLabels.map((d) => (
                    <View key={d} style={styles.cell}>
                        <Text style={styles.dayLabel}>{d}</Text>
                    </View>
                ))}
            </View>

            {Array.from({ length: cells.length / 7 }, (_, weekIdx) => (
                <View key={weekIdx} style={styles.row}>
                    {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, cellIdx) => {
                        if (day === null) return <View key={cellIdx} style={styles.cell} />;
                        const cellDate = new Date(viewYear, viewMonth, day);
                        const isSelected = isSameDay(cellDate, selectedDate);
                        const isToday = isSameDay(cellDate, today);
                        const markerColors = dayCategoryColors?.[formatDateKey(cellDate)] ?? [];
                        return (
                            <Pressable
                                key={cellIdx}
                                style={styles.cell}
                                onPress={() => selectDay(day)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isSelected }}
                            >
                                <View
                                    style={[
                                        styles.dayBubble,
                                        isToday && styles.todayBubble,
                                        isSelected && styles.selectedBubble,
                                    ]}
                                >
                                    <Text style={[styles.dayText, isSelected && styles.selectedText]}>{day}</Text>
                                </View>
                                <View style={styles.markerRow}>
                                    {markerColors.slice(0, MAX_MARKER_DOTS).map((markerColor, index) => (
                                        <View key={index} style={[styles.markerDot, { backgroundColor: markerColor }]} />
                                    ))}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            ))}
            <View style={styles.bottomSpace} />
        </Sheet>
    );
}

const MAX_MARKER_DOTS = 7;

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { flexDirection: "row" },
        cell: { flex: 1, alignItems: "center", paddingVertical: 3 },
        dayLabel: { fontSize: fontSize.xxs, fontWeight: "600", color: colors.textTertiary, paddingBottom: spacing.xs },
        dayBubble: {
            width: 38,
            height: 38,
            borderRadius: borderRadius.full,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "transparent",
        },
        todayBubble: { borderColor: colors.borderStrong },
        selectedBubble: { backgroundColor: colors.primary, borderColor: colors.primary },
        dayText: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text, fontVariant: ["tabular-nums"] },
        selectedText: { color: colors.onPrimary, fontWeight: "700" },
        // Workout days carry one dot per trained muscle group.
        markerRow: { flexDirection: "row", gap: 2, height: 4, marginTop: 2 },
        markerDot: { width: 4, height: 4, borderRadius: borderRadius.full },
        bottomSpace: { height: spacing.sm },
    });
}
