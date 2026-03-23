import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";
import CalendarPicker from "@/src/components/CalendarPicker";

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
    const [calendarVisible, setCalendarVisible] = useState(false);

    function shiftDay(delta: number) {
        const next = new Date(date);
        next.setDate(next.getDate() + delta);
        onDateChange(next);
    }

    const today = new Date();
    const isToday = isSameDay(date, today);

    const label = isToday
        ? "Today"
        : date.toLocaleDateString("en-US", {
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

const styles = StyleSheet.create({
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
