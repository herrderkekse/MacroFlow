import { SUPPORTED_LANGUAGES } from "@/src/i18n";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import type { AppearanceMode, Language, UnitSystem } from "@/src/shared/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NotificationSettings from "../components/NotificationSettings";
import SettingsToggleRow from "../components/SettingsToggleRow";
import { setGoals } from "../services/settingsDb";

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
    const keepAwakeInWorkout = useAppStore((s) => s.keepAwakeInWorkout);
    const setKeepAwakeInWorkout = useAppStore((s) => s.setKeepAwakeInWorkout);

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

    function handleKeepAwakeChange(value: boolean) {
        setKeepAwakeInWorkout(value);
        setGoals({ keep_awake: value ? 1 : 0 });
    }

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

            <SettingsToggleRow
                colors={colors}
                label={t("settings.keepAwakeInWorkout")}
                description={t("settings.keepAwakeInWorkoutDescription")}
                value={keepAwakeInWorkout}
                onValueChange={handleKeepAwakeChange}
            />

            <NotificationSettings colors={colors} />
        </ScrollView>
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
    });
}