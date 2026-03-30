import CalendarPicker from "@/src/components/CalendarPicker";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface DateSelectorBarProps {
    date: Date;
    onDateChange: (date: Date) => void;
}

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export default function DateSelectorBar({
    date,
    onDateChange,
}: DateSelectorBarProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t, i18n } = useTranslation();
    const [calendarVisible, setCalendarVisible] = useState(false);

    function shiftDay(delta: number) {
        const next = new Date(date);
        next.setDate(next.getDate() + delta);
        onDateChange(next);
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = isSameDay(date, today);
    const isYesterday = isSameDay(date, yesterday);
    const isTomorrow = isSameDay(date, tomorrow);

    const label = isToday
        ? t("log.today")
        : isYesterday
            ? t("log.yesterday")
            : isTomorrow
                ? t("log.tomorrow")
                : date.toLocaleDateString(i18n.language, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                });

    return (
        <>
            <View style={styles.container}>
                <Pressable
                    onPress={() => shiftDay(-1)}
                    hitSlop={12}
                    style={styles.arrow}
                >
                    <Ionicons
                        name="chevron-back"
                        size={22}
                        color={colors.text}
                    />
                </Pressable>

                <Pressable
                    onPress={() => setCalendarVisible(true)}
                    style={styles.dateButton}
                >
                    <Text style={styles.dateText}>{label}</Text>
                    <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={colors.textSecondary}
                        style={styles.calendarIcon}
                    />
                </Pressable>

                <Pressable
                    onPress={() => shiftDay(1)}
                    hitSlop={12}
                    style={styles.arrow}
                >
                    <Ionicons
                        name="chevron-forward"
                        size={22}
                        color={colors.text}
                    />
                </Pressable>
            </View>

            <CalendarPicker
                visible={calendarVisible}
                selectedDate={date}
                onSelect={(d) => {
                    onDateChange(d);
                    setCalendarVisible(false);
                }}
                onClose={() => setCalendarVisible(false)}
            />
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            marginBottom: spacing.md,
        },
        arrow: {
            padding: spacing.xs,
        },
        dateButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
        },
        dateText: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
        },
        calendarIcon: {
            marginLeft: 2,
        },
    });
}
