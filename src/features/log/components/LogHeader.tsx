import { getWorkoutMuscleGroupsByDateRange } from "@/src/features/exercise/services/workoutDb";
import IconButton from "@/src/shared/atoms/IconButton";
import CalendarPicker from "@/src/shared/components/CalendarPicker";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { formatDateKey } from "@/src/utils/date";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface LogHeaderProps {
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

/**
 * The log's header: the selected day as the screen title (tap for the
 * calendar) and arrows to step a day back or forward.
 */
export default function LogHeader({ date, onDateChange }: LogHeaderProps) {
    const colors = useThemeColors();
    const { t, i18n } = useTranslation();
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [dayCategoryColors, setDayCategoryColors] = useState<Record<string, string[]>>({});

    const muscleGroupColorMap: Record<string, string> = useMemo(() => ({
        chest: colors.exerciseChest,
        back: colors.exerciseBack,
        legs: colors.exerciseLegs,
        shoulders: colors.exerciseShoulders,
        arms: colors.exerciseArms,
        core: colors.exerciseCore,
        full_body: colors.exerciseFullBody,
    }), [colors]);

    const loadMonthCategoryColors = useCallback((year: number, month: number) => {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        const groupsByDate = getWorkoutMuscleGroupsByDateRange(
            formatDateKey(monthStart),
            formatDateKey(monthEnd),
        );

        const nextColors: Record<string, string[]> = {};
        for (const [dateKey, muscleGroups] of Object.entries(groupsByDate)) {
            const colorsForDate = Array.from(
                new Set(
                    muscleGroups
                        .map((group) => muscleGroupColorMap[group])
                        .filter((color): color is string => color != null),
                ),
            );
            if (colorsForDate.length > 0) nextColors[dateKey] = colorsForDate;
        }
        setDayCategoryColors(nextColors);
    }, [muscleGroupColorMap]);

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

    const relativeLabel = isToday
        ? t("log.today")
        : isYesterday
            ? t("log.yesterday")
            : isTomorrow
                ? t("log.tomorrow")
                : null;
    const fullDate = date.toLocaleDateString(i18n.language, { weekday: "long", month: "long", day: "numeric" });
    const shortDate = date.toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" });

    return (
        <>
            <ScreenHeader
                variant="large"
                title={relativeLabel ?? shortDate}
                subtitle={relativeLabel ? fullDate : String(date.getFullYear())}
                onTitlePress={() => setCalendarVisible(true)}
                right={
                    <>
                        <IconButton icon="chevron-back" label={t("log.previousDay")} onPress={() => shiftDay(-1)} />
                        <IconButton icon="chevron-forward" label={t("log.nextDay")} onPress={() => shiftDay(1)} />
                    </>
                }
            />

            <CalendarPicker
                visible={calendarVisible}
                selectedDate={date}
                onSelect={(d) => {
                    onDateChange(d);
                    setCalendarVisible(false);
                }}
                onClose={() => setCalendarVisible(false)}
                dayCategoryColors={dayCategoryColors}
                onViewMonthChange={loadMonthCategoryColors}
            />
        </>
    );
}
