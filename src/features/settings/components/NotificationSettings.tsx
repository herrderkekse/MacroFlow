import { getEntriesByDate, getWeightLogsForDate } from "@/src/features/log/services/logDb";
import { cancelAllReminders, requestNotificationPermissions, scheduleAllReminders } from "@/src/services/notifications";
import IconButton from "@/src/shared/atoms/IconButton";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import Toggle from "@/src/shared/atoms/Toggle";
import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import type { MealType } from "@/src/shared/types";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { getNotificationSettings, setNotificationSettings } from "../services/settingsDb";

const NOTIF_TIME_ROWS = [
    { key: "breakfast_time" as const, labelKey: "settings.notificationBreakfast", enabledKey: "breakfast_enabled" as const },
    { key: "lunch_time" as const, labelKey: "settings.notificationLunch", enabledKey: "lunch_enabled" as const },
    { key: "dinner_time" as const, labelKey: "settings.notificationDinner", enabledKey: "dinner_enabled" as const },
    { key: "snack_time" as const, labelKey: "settings.notificationSnack", enabledKey: "snack_enabled" as const },
    { key: "weight_time" as const, labelKey: "settings.notificationWeight", enabledKey: "weight_enabled" as const },
];

export default function NotificationSettings() {
    const { t } = useTranslation();

    const [notifEnabled, setNotifEnabled] = useState(false);
    const [notifTimes, setNotifTimes] = useState({
        breakfast_time: "08:00",
        lunch_time: "12:00",
        dinner_time: "18:00",
        snack_time: "15:00",
        weight_time: "07:30",
    });
    const [notifRowEnabled, setNotifRowEnabled] = useState({
        breakfast_enabled: true,
        lunch_enabled: true,
        dinner_enabled: true,
        snack_enabled: true,
        weight_enabled: true,
    });

    useEffect(() => {
        queueMicrotask(() => {
            const s = getNotificationSettings();
            if (s) {
                setNotifEnabled(!!s.enabled);
                setNotifTimes({
                    breakfast_time: s.breakfast_time,
                    lunch_time: s.lunch_time,
                    dinner_time: s.dinner_time,
                    snack_time: s.snack_time,
                    weight_time: s.weight_time,
                });
                setNotifRowEnabled({
                    breakfast_enabled: s.breakfast_enabled !== 0,
                    lunch_enabled: s.lunch_enabled !== 0,
                    dinner_enabled: s.dinner_enabled !== 0,
                    snack_enabled: s.snack_enabled !== 0,
                    weight_enabled: s.weight_enabled !== 0,
                });
            }
        });
    }, []);

    function getMealLabels() {
        return {
            breakfast: t("settings.notificationBreakfast"),
            lunch: t("settings.notificationLunch"),
            dinner: t("settings.notificationDinner"),
            snack: t("settings.notificationSnack"),
        } as Record<MealType, string>;
    }

    function getScheduleContext() {
        const settings = getNotificationSettings() ?? null;
        const todayEntries = getEntriesByDate(new Date());
        const loggedMealTypes = new Set(todayEntries.map(e => e.entries.meal_type as MealType));
        const hasWeightLog = getWeightLogsForDate(new Date()).length > 0;
        return { settings, loggedMealTypes, hasWeightLog };
    }

    async function handleToggleNotifications(value: boolean) {
        if (value) {
            const granted = await requestNotificationPermissions();
            if (!granted) {
                Alert.alert(t("settings.title"), t("settings.notificationPermissionDenied"));
                return;
            }
        }
        setNotifEnabled(value);
        setNotificationSettings({ enabled: value ? 1 : 0 });
        if (value) {
            const ctx = getScheduleContext();
            await scheduleAllReminders(getMealLabels(), t("settings.notificationWeight"), ctx.settings, ctx.loggedMealTypes, ctx.hasWeightLog);
        } else {
            await cancelAllReminders();
        }
    }

    function handleRowToggle(key: keyof typeof notifRowEnabled) {
        const newValue = !notifRowEnabled[key];
        setNotifRowEnabled((prev) => ({ ...prev, [key]: newValue }));
        setNotificationSettings({ [key]: newValue ? 1 : 0 });
        const ctx = getScheduleContext();
        scheduleAllReminders(getMealLabels(), t("settings.notificationWeight"), ctx.settings, ctx.loggedMealTypes, ctx.hasWeightLog);
    }

    function handleTimeChange(key: keyof typeof notifTimes, value: string) {
        if (!/^\d{2}:\d{2}$/.test(value)) return;
        const [h, m] = value.split(":").map(Number);
        if (h < 0 || h > 23 || m < 0 || m > 59) return;

        setNotifTimes((prev) => ({ ...prev, [key]: value }));
        setNotificationSettings({ [key]: value });
        if (notifEnabled) {
            const ctx = getScheduleContext();
            scheduleAllReminders(getMealLabels(), t("settings.notificationWeight"), ctx.settings, ctx.loggedMealTypes, ctx.hasWeightLog);
        }
    }

    return (
        <>
            <SectionLabel>{t("settings.notifications")}</SectionLabel>
            <ListGroup>
                <ListRow
                    title={t("settings.notificationsEnabled")}
                    subtitle={t("settings.notificationsDescription")}
                    right={<Toggle value={notifEnabled} onValueChange={handleToggleNotifications} />}
                />
                {notifEnabled &&
                    NOTIF_TIME_ROWS.map((row) => (
                        <TimeRow
                            key={row.key}
                            label={t(row.labelKey)}
                            value={notifTimes[row.key]}
                            onChange={(v) => handleTimeChange(row.key, v)}
                            enabled={notifRowEnabled[row.enabledKey]}
                            onToggleEnabled={() => handleRowToggle(row.enabledKey)}
                        />
                    ))}
            </ListGroup>
        </>
    );
}

interface TimeRowProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    enabled: boolean;
    onToggleEnabled: () => void;
}

/** One reminder: its time in 15-minute steps, and a bell to mute just this one. */
function TimeRow({ label, value, onChange, enabled, onToggleEnabled }: TimeRowProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [h, m] = value.split(":").map(Number);

    function adjust(delta: number) {
        const totalMin = (h * 60 + m + delta + 1440) % 1440;
        const newH = String(Math.floor(totalMin / 60)).padStart(2, "0");
        const newM = String(totalMin % 60).padStart(2, "0");
        onChange(`${newH}:${newM}`);
    }

    return (
        <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, !enabled && styles.timeLabelDisabled]} numberOfLines={1}>{label}</Text>
            {enabled && (
                <View style={styles.stepper}>
                    <IconButton icon="remove" size="sm" label={t("settings.earlier")} onPress={() => adjust(-15)} />
                    <Text style={styles.timeValue}>{value}</Text>
                    <IconButton icon="add" size="sm" label={t("settings.later")} onPress={() => adjust(15)} />
                </View>
            )}
            <IconButton
                icon={enabled ? "notifications" : "notifications-off-outline"}
                label={enabled ? t("settings.reminderOn") : t("settings.reminderOff")}
                color={enabled ? colors.text : colors.textTertiary}
                onPress={onToggleEnabled}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        timeRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: 56,
            paddingLeft: screenPadding,
            paddingRight: spacing.sm,
        },
        timeLabel: { flex: 1, fontSize: fontSize.md, fontWeight: "500", color: colors.text },
        timeLabelDisabled: { color: colors.textTertiary },
        stepper: {
            flexDirection: "row",
            alignItems: "center",
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            paddingHorizontal: 2,
        },
        timeValue: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            minWidth: 48,
            textAlign: "center",
            fontVariant: ["tabular-nums"],
        },
    });
}
