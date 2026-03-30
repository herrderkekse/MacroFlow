import { getNotificationSettings, setGoals, setNotificationSettings } from "@/src/db/queries";
import { SUPPORTED_LANGUAGES } from "@/src/i18n";
import { useAppStore } from "@/src/store/useAppStore";
import type { AppearanceMode, Language, MealType, UnitSystem } from "@/src/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelAllReminders, requestNotificationPermissions, scheduleAllReminders } from "@/src/services/notifications";

const LANGUAGE_LABELS: Record<Language, string> = {
    en: "English",
    de: "Deutsch",
};

export default function SettingsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const unitSystem = useAppStore((s) => s.unitSystem);
    const setUnitSystem = useAppStore((s) => s.setUnitSystem);
    const appearanceMode = useAppStore((s) => s.appearanceMode);
    const setAppearanceMode = useAppStore((s) => s.setAppearanceMode);
    const language = useAppStore((s) => s.language);
    const setLanguage = useAppStore((s) => s.setLanguage);

    // ── Notification state ──────────────────────────────
    const [notifEnabled, setNotifEnabled] = useState(false);
    const [notifTimes, setNotifTimes] = useState({
        breakfast_time: "08:00",
        lunch_time: "12:00",
        dinner_time: "18:00",
        snack_time: "15:00",
        weight_time: "07:30",
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
            await scheduleAllReminders(getMealLabels(), t("settings.notificationWeight"));
        } else {
            await cancelAllReminders();
        }
    }

    function handleTimeChange(key: keyof typeof notifTimes, value: string) {
        // Validate HH:MM format
        if (!/^\d{2}:\d{2}$/.test(value)) return;
        const [h, m] = value.split(":").map(Number);
        if (h < 0 || h > 23 || m < 0 || m > 59) return;

        setNotifTimes((prev) => ({ ...prev, [key]: value }));
        setNotificationSettings({ [key]: value });
        if (notifEnabled) {
            scheduleAllReminders(getMealLabels(), t("settings.notificationWeight"));
        }
    }

    const UNIT_OPTIONS: { key: UnitSystem; label: string }[] = [
        { key: "metric", label: t("settings.unitsMetric") },
        { key: "imperial", label: t("settings.unitsImperial") },
    ];

    const APPEARANCE_OPTIONS: { key: AppearanceMode; label: string }[] = [
        { key: "system", label: t("settings.appearanceSystem") },
        { key: "light", label: t("settings.appearanceLight") },
        { key: "dark", label: t("settings.appearanceDark") },
    ];

    function handleUnitChange(system: UnitSystem) {
        setUnitSystem(system);
        setGoals({ unit_system: system });
    }

    function handleLanguageChange(lang: Language) {
        setLanguage(lang);
        setGoals({ language: lang });
    }

    const NOTIF_TIME_ROWS: { key: keyof typeof notifTimes; labelKey: string }[] = [
        { key: "breakfast_time", labelKey: "settings.notificationBreakfast" },
        { key: "lunch_time", labelKey: "settings.notificationLunch" },
        { key: "dinner_time", labelKey: "settings.notificationDinner" },
        { key: "snack_time", labelKey: "settings.notificationSnack" },
        { key: "weight_time", labelKey: "settings.notificationWeight" },
    ];

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.headerRow}>
                <Pressable onPress={() => router.navigate("/(tabs)/more" as any)} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </Pressable>
                <Text style={styles.heading}>{t("settings.title")}</Text>
            </View>

            {/* ── Language ────────────────────────────────── */}
            <Text style={styles.sectionLabel}>{t("settings.language")}</Text>
            <View style={styles.chipRow}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                    <Pressable
                        key={lang}
                        style={[styles.chip, language === lang && styles.chipActive]}
                        onPress={() => handleLanguageChange(lang)}
                    >
                        <Text style={[styles.chipText, language === lang && styles.chipTextActive]}>
                            {LANGUAGE_LABELS[lang]}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* ── Appearance ──────────────────────────────── */}
            <Text style={styles.sectionLabel}>{t("settings.appearance")}</Text>
            <View style={styles.chipRow}>
                {APPEARANCE_OPTIONS.map((opt) => (
                    <Pressable
                        key={opt.key}
                        style={[styles.chip, appearanceMode === opt.key && styles.chipActive]}
                        onPress={() => { setAppearanceMode(opt.key); setGoals({ appearance_mode: opt.key }); }}
                    >
                        <Text style={[styles.chipText, appearanceMode === opt.key && styles.chipTextActive]}>
                            {opt.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* ── Unit System ─────────────────────────────── */}
            <Text style={styles.sectionLabel}>{t("settings.units")}</Text>
            <View style={styles.chipRow}>
                {UNIT_OPTIONS.map((opt) => (
                    <Pressable
                        key={opt.key}
                        style={[styles.chip, unitSystem === opt.key && styles.chipActive]}
                        onPress={() => handleUnitChange(opt.key)}
                    >
                        <Text style={[styles.chipText, unitSystem === opt.key && styles.chipTextActive]}>
                            {opt.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* ── Notifications ────────────────────────────── */}
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
                            colors={colors}
                            styles={styles}
                        />
                    ))}
                </>
            )}
        </ScrollView>
    );
}

function TimeRow({
    label,
    value,
    onChange,
    colors,
    styles,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
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
        <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{label}</Text>
            <View style={styles.timeControls}>
                <Pressable onPress={() => adjust(-15)} hitSlop={6}>
                    <Ionicons name="remove-circle-outline" size={22} color={colors.primary} />
                </Pressable>
                <Text style={styles.timeValue}>{value}</Text>
                <Pressable onPress={() => adjust(15)} hitSlop={6}>
                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </Pressable>
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: 40 },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        backBtn: { padding: 4 },
        heading: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
        },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.md,
        },
        chipRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        chip: {
            flex: 1,
            paddingVertical: spacing.sm + 2,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
        },
        chipActive: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
        },
        chipText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        chipTextActive: {
            color: colors.primary,
            fontWeight: "600",
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
        timeLabel: {
            fontSize: fontSize.sm,
            color: colors.text,
            fontWeight: "500",
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
    });
}
