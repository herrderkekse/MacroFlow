import IconButton from "@/src/shared/atoms/IconButton";
import CalendarPicker from "@/src/shared/components/CalendarPicker";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface DateFieldProps {
    value: Date;
    onChange: (date: Date) => void;
    style?: StyleProp<ViewStyle>;
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function shift(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

/**
 * The one date input outside the log header: arrows step a day, the label
 * opens the calendar. Shows "Today / Yesterday / Tomorrow" where it applies.
 */
export default function DateField({ value, onChange, style }: DateFieldProps) {
    const colors = useThemeColors();
    const { t, i18n } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const today = new Date();
    const label = isSameDay(value, today)
        ? t("log.today")
        : isSameDay(value, shift(today, 1))
            ? t("log.tomorrow")
            : isSameDay(value, shift(today, -1))
                ? t("log.yesterday")
                : value.toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" });

    return (
        <>
            <View style={[styles.container, style]}>
                <IconButton icon="chevron-back" label={t("log.previousDay")} onPress={() => onChange(shift(value, -1))} />
                <Pressable
                    style={({ pressed }) => [styles.label, pressed && styles.pressed]}
                    onPress={() => setIsCalendarOpen(true)}
                    accessibilityRole="button"
                >
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.labelText} numberOfLines={1}>{label}</Text>
                </Pressable>
                <IconButton icon="chevron-forward" label={t("log.nextDay")} onPress={() => onChange(shift(value, 1))} />
            </View>
            <CalendarPicker
                visible={isCalendarOpen}
                selectedDate={value}
                onSelect={(date) => {
                    onChange(date);
                    setIsCalendarOpen(false);
                }}
                onClose={() => setIsCalendarOpen(false)}
            />
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: controlHeight.md,
            paddingHorizontal: spacing.xs,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
        },
        label: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, alignSelf: "stretch" },
        pressed: { opacity: 0.6 },
        labelText: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    });
}
