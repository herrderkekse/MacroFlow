import { requestNotificationPermission } from "@/src/features/exercise/services/restTimerNotifications";
import { SUPPORTED_LANGUAGES } from "@/src/i18n";
import Card from "@/src/shared/atoms/Card";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import Toggle from "@/src/shared/atoms/Toggle";
import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import type { AppearanceMode, ExerciseTimerSound, Language, UnitSystem } from "@/src/shared/types";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import NotificationSettings from "../components/NotificationSettings";
import SyncSettings from "../components/SyncSettings";
import { setGoals } from "../services/settingsDb";

const LANGUAGE_LABELS: Record<Language, string> = {
    en: "English",
    de: "Deutsch",
};

export default function SettingsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const unitSystem = useAppStore((s) => s.unitSystem);
    const setUnitSystem = useAppStore((s) => s.setUnitSystem);
    const appearanceMode = useAppStore((s) => s.appearanceMode);
    const setAppearanceMode = useAppStore((s) => s.setAppearanceMode);
    const language = useAppStore((s) => s.language);
    const setLanguage = useAppStore((s) => s.setLanguage);
    const keepAwakeInWorkout = useAppStore((s) => s.keepAwakeInWorkout);
    const setKeepAwakeInWorkout = useAppStore((s) => s.setKeepAwakeInWorkout);
    const exerciseTimerSound = useAppStore((s) => s.exerciseTimerSound);
    const setExerciseTimerSound = useAppStore((s) => s.setExerciseTimerSound);

    function handleUnitChange(system: UnitSystem) {
        setUnitSystem(system);
        setGoals({ unit_system: system });
    }

    function handleLanguageChange(lang: Language) {
        setLanguage(lang);
        setGoals({ language: lang });
    }

    function handleAppearanceChange(mode: AppearanceMode) {
        setAppearanceMode(mode);
        setGoals({ appearance_mode: mode });
    }

    function handleKeepAwakeChange(value: boolean) {
        setKeepAwakeInWorkout(value);
        setGoals({ keep_awake: value ? 1 : 0 });
    }

    async function handleTimerSoundChange(value: ExerciseTimerSound) {
        setExerciseTimerSound(value);
        setGoals({ exercise_timer_sound: value });
        // Enabling the sound relies on notifications for the off-screen chime;
        // ask up front rather than surprising the user mid-workout.
        if (value !== "off") {
            const granted = await requestNotificationPermission();
            if (!granted) {
                Alert.alert(t("settings.title"), t("settings.notificationPermissionDenied"));
            }
        }
    }

    return (
        <View style={styles.screen}>
            <ScreenHeader title={t("settings.title")} />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <SectionLabel style={styles.firstLabel}>{t("settings.groupGeneral")}</SectionLabel>
                <Card style={styles.fieldCard}>
                    <FieldLabel style={styles.firstField}>{t("settings.language")}</FieldLabel>
                    <SegmentedControl
                        options={SUPPORTED_LANGUAGES.map((lang) => ({ key: lang, label: LANGUAGE_LABELS[lang] }))}
                        value={language}
                        onChange={handleLanguageChange}
                    />

                    <FieldLabel>{t("settings.appearance")}</FieldLabel>
                    <SegmentedControl<AppearanceMode>
                        options={[
                            { key: "system", label: t("settings.appearanceSystem"), icon: "phone-portrait-outline" },
                            { key: "light", label: t("settings.appearanceLight"), icon: "sunny-outline" },
                            { key: "dark", label: t("settings.appearanceDark"), icon: "moon-outline" },
                        ]}
                        value={appearanceMode}
                        onChange={handleAppearanceChange}
                    />

                    <FieldLabel>{t("settings.units")}</FieldLabel>
                    <SegmentedControl<UnitSystem>
                        options={[
                            { key: "metric", label: t("settings.unitsMetric") },
                            { key: "imperial", label: t("settings.unitsImperial") },
                        ]}
                        value={unitSystem}
                        onChange={handleUnitChange}
                    />
                </Card>

                <SectionLabel>{t("settings.groupWorkout")}</SectionLabel>
                <ListGroup>
                    <ListRow
                        title={t("settings.keepAwakeInWorkout")}
                        subtitle={t("settings.keepAwakeInWorkoutDescription")}
                        right={<Toggle value={keepAwakeInWorkout} onValueChange={handleKeepAwakeChange} />}
                    />
                    <View style={styles.inlineField}>
                        <FieldLabel style={styles.firstField}>{t("settings.exerciseTimerSound")}</FieldLabel>
                        <SegmentedControl<ExerciseTimerSound>
                            options={[
                                { key: "off", label: t("settings.exerciseTimerSoundOff") },
                                { key: "on", label: t("settings.exerciseTimerSoundOn") },
                                { key: "bluetooth", label: t("settings.exerciseTimerSoundBluetooth") },
                            ]}
                            value={exerciseTimerSound}
                            onChange={handleTimerSoundChange}
                        />
                        <Text style={styles.hint}>{t("settings.exerciseTimerSoundDescription")}</Text>
                    </View>
                </ListGroup>

                <NotificationSettings />

                <SyncSettings />
            </ScrollView>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl },
        firstLabel: { marginTop: spacing.sm },
        fieldCard: { paddingTop: spacing.md },
        firstField: { marginTop: 0 },
        inlineField: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
        hint: { fontSize: fontSize.xs, lineHeight: 17, color: colors.textSecondary, marginTop: spacing.sm },
    });
}
