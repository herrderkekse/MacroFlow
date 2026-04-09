import { getEntriesByDate, getWeightLogsForDate } from "@/src/features/log/services/logDb";
import { cancelAllReminders, requestNotificationPermissions, scheduleAllReminders } from "@/src/services/notifications";
import type { MealType } from "@/src/shared/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { getNotificationSettings, setNotificationSettings } from "../services/settingsDb";

interface NotificationSettingsProps {
    colors: ThemeColors;
}

const NOTIF_TIME_ROWS = [
    { key: "breakfast_time" as const, labelKey: "settings.notificationBreakfast", enabledKey: "breakfast_enabled" as const },
    { key: "lunch_time" as const, labelKey: "settings.notificationLunch", enabledKey: "lunch_enabled" as const },
    { key: "dinner_time" as const, labelKey: "settings.notificationDinner", enabledKey: "dinner_enabled" as const },
    { key: "snack_time" as const, labelKey: "settings.notificationSnack", enabledKey: "snack_enabled" as const },
    { key: "weight_time" as const, labelKey: "settings.notificationWeight", enabledKey: "weight_enabled" as const },
];

export default function NotificationSettings({ colors }: NotificationSettingsProps) {
    const { t } = useTranslation();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

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
            <Text style={styles.sectionLabel}>{t("settings.notifications")}</Text>
            <Text style={styles.notifDescription}>{t("settings.notificationsDescription")}</Text>
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("settings.notificationsEnabled")}</Text>
                <Switch
                    value={notifEnabled}
                    onValueChange={handleToggleNotifications}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={notifEnabled ? colors.primaryLight : colors.surface}
                />
            </View>

            {notifEnabled && (
                <>
                    <Text style={styles.sectionLabel}>{t("settings.notificationTimes")}</Text>
                    {NOTIF_TIME_ROWS.map((row) => (
                        <TimeRow
                            key={row.key}
                            label={t(row.labelKey)}
                            value={notifTimes[row.key]}
                            onChange={(v) => handleTimeChange(row.key, v)}
                            enabled={notifRowEnabled[row.enabledKey]}
                            onToggleEnabled={() => handleRowToggle(row.enabledKey)}
                            colors={colors}
                            styles={styles}
                        />
                    ))}
                </>
            )}
        </>
    );
}

function TimeRow({
    label,
    value,
    onChange,
    enabled,
    onToggleEnabled,
    colors,
    styles,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    enabled: boolean;
    onToggleEnabled: () => void;
    colors: ThemeColors;
    styles: ReturnType<typeof createStyles>;
}) {
    const [h, m] = value.split(":").map(Number);

    function adjust(delta: number) {
        let totalMin = (h * 60 + m + delta + 1440) % 1440;
        const newH = String(Math.floor(totalMin / 60)).padStart(2, "0");
        const newM = String(totalMin % 60).padStart(2, "0");
        onChange(`${newH}:${newM}`);
    }

    return (
        <View style={[styles.timeRow, !enabled && styles.timeRowDisabled]}>
            <Text style={[styles.timeLabel, !enabled && styles.timeLabelDisabled]}>{label}</Text>
            <View style={styles.timeControls}>
                {enabled && (
                    <>
                        <Pressable onPress={() => adjust(-15)} hitSlop={6}>
                            <Ionicons name="remove-circle-outline" size={22} color={colors.primary} />
                        </Pressable>
                        <Text style={styles.timeValue}>{value}</Text>
                        <Pressable onPress={() => adjust(15)} hitSlop={6}>
                            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                        </Pressable>
                    </>
                )}
                <Pressable onPress={onToggleEnabled} hitSlop={6} style={styles.bellBtn}>
                    <Ionicons
                        name={enabled ? "notifications" : "notifications-off-outline"}
                        size={22}
                        color={enabled ? colors.primary : colors.textSecondary}
                    />
                </Pressable>
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.md,
        },
        notifDescription: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        switchRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            marginBottom: spacing.md,
        },
        switchLabel: {
            fontSize: fontSize.sm,
            color: colors.text,
            fontWeight: "500",
        },
        timeRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            marginBottom: spacing.sm,
        },
        timeRowDisabled: {
            opacity: 0.5,
        },
        timeLabel: {
            fontSize: fontSize.sm,
            color: colors.text,
            fontWeight: "500",
        },
        timeLabelDisabled: {
            color: colors.textSecondary,
        },
        timeControls: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        timeValue: {
            fontSize: fontSize.md,
            fontWeight: "700",
            color: colors.text,
            minWidth: 50,
            textAlign: "center",
        },
        bellBtn: {
            marginLeft: spacing.xs,
        },
    });
}
