import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { getGoals, setGoals } from "@/src/db/queries";
import { SUPPORTED_LANGUAGES } from "@/src/i18n";
import { exportData, importData } from "@/src/services/importExport";
import { useAppStore } from "@/src/store/useAppStore";
import type { AppearanceMode, Language, UnitSystem } from "@/src/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LANGUAGE_LABELS: Record<Language, string> = {
    en: "English",
    de: "Deutsch",
};

export default function SettingsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();

    const unitSystem = useAppStore((s) => s.unitSystem);
    const setUnitSystem = useAppStore((s) => s.setUnitSystem);
    const appearanceMode = useAppStore((s) => s.appearanceMode);
    const setAppearanceMode = useAppStore((s) => s.setAppearanceMode);
    const language = useAppStore((s) => s.language);
    const setLanguage = useAppStore((s) => s.setLanguage);

    const UNIT_OPTIONS: { key: UnitSystem; label: string }[] = [
        { key: "metric", label: t("settings.unitsMetric") },
        { key: "imperial", label: t("settings.unitsImperial") },
    ];

    const APPEARANCE_OPTIONS: { key: AppearanceMode; label: string }[] = [
        { key: "system", label: t("settings.appearanceSystem") },
        { key: "light", label: t("settings.appearanceLight") },
        { key: "dark", label: t("settings.appearanceDark") },
    ];

    const [calories, setCalories] = useState("2000");
    const [protein, setProtein] = useState("150");
    const [carbs, setCarbs] = useState("250");
    const [fat, setFat] = useState("70");

    useEffect(() => {
        const g = getGoals();
        if (g) {
            setCalories(String(g.calories));
            setProtein(String(g.protein));
            setCarbs(String(g.carbs));
            setFat(String(g.fat));
            if (g.unit_system === "metric" || g.unit_system === "imperial") {
                setUnitSystem(g.unit_system as UnitSystem);
            }
        }
    }, []);

    function handleSave() {
        const cal = parseFloat(calories) || 0;
        const p = parseFloat(protein) || 0;
        const c = parseFloat(carbs) || 0;
        const f = parseFloat(fat) || 0;

        if (cal <= 0) {
            Alert.alert(t("settings.invalid"), t("settings.caloriesMustBeGreater"));
            return;
        }

        setGoals({
            calories: cal,
            protein: p,
            carbs: c,
            fat: f,
            unit_system: unitSystem,
        });
        Alert.alert(t("settings.saved"), t("settings.goalsUpdated"));
    }

    function handleUnitChange(system: UnitSystem) {
        setUnitSystem(system);
        setGoals({ unit_system: system });
    }

    function handleLanguageChange(lang: Language) {
        setLanguage(lang);
        setGoals({ language: lang });
    }

    // ── Import / Export ─────────────────────────────────
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    async function handleExport() {
        try {
            setExporting(true);
            await exportData();
        } catch (e: any) {
            Alert.alert(t("settings.exportFailed"), e.message ?? "Unknown error");
        } finally {
            setExporting(false);
        }
    }

    function handleImportConfirm() {
        Alert.alert(
            t("settings.importTitle"),
            t("settings.importWarning"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("settings.importData"), style: "destructive", onPress: handleImport },
            ],
        );
    }

    async function handleImport() {
        try {
            setImporting(true);
            const { inserted } = await importData();
            // Reload goals into local state after import
            const g = getGoals();
            if (g) {
                setCalories(String(g.calories));
                setProtein(String(g.protein));
                setCarbs(String(g.carbs));
                setFat(String(g.fat));
                if (g.unit_system === "metric" || g.unit_system === "imperial") {
                    setUnitSystem(g.unit_system as UnitSystem);
                }
            }
            Alert.alert(
                t("settings.importComplete"),
                t("settings.recordsRestored_other", { count: inserted }),
            );
        } catch (e: any) {
            if (e.message !== "cancelled") {
                Alert.alert(t("settings.importFailed"), e.message ?? "Unknown error");
            }
        } finally {
            setImporting(false);
        }
    }

    // Compute macro percentages
    const pCal = (parseFloat(protein) || 0) * 4;
    const cCal = (parseFloat(carbs) || 0) * 4;
    const fCal = (parseFloat(fat) || 0) * 9;
    const macroTotal = pCal + cCal + fCal;

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.heading}>{t("settings.title")}</Text>

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
                        style={[
                            styles.chip,
                            appearanceMode === opt.key && styles.chipActive,
                        ]}
                        onPress={() => setAppearanceMode(opt.key)}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                appearanceMode === opt.key && styles.chipTextActive,
                            ]}
                        >
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
                        style={[
                            styles.chip,
                            unitSystem === opt.key && styles.chipActive,
                        ]}
                        onPress={() => handleUnitChange(opt.key)}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                unitSystem === opt.key && styles.chipTextActive,
                            ]}
                        >
                            {opt.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* ── Calorie Goal ────────────────────────────── */}
            <Text style={styles.sectionLabel}>{t("settings.dailyGoals")}</Text>

            <Input
                label={t("settings.calories")}
                value={calories}
                onChangeText={setCalories}
                keyboardType="decimal-pad"
                suffix={t("common.kcal")}
                containerStyle={styles.field}
            />

            {/* ── Macro Goals ─────────────────────────────── */}
            <View style={styles.row}>
                <Input
                    label={t("settings.protein")}
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="decimal-pad"
                    suffix={t("common.g")}
                    containerStyle={styles.thirdField}
                />
                <Input
                    label={t("settings.carbs")}
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="decimal-pad"
                    suffix={t("common.g")}
                    containerStyle={styles.thirdField}
                />
                <Input
                    label={t("settings.fat")}
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="decimal-pad"
                    suffix={t("common.g")}
                    containerStyle={styles.thirdField}
                />
            </View>

            {/* Macro breakdown preview */}
            {macroTotal > 0 && (
                <View style={styles.breakdownCard}>
                    <Text style={styles.breakdownTitle}>{t("settings.macroBreakdown")}</Text>
                    <View style={styles.barContainer}>
                        <View
                            style={[
                                styles.barSegment,
                                {
                                    flex: pCal,
                                    backgroundColor: colors.protein,
                                    borderTopLeftRadius: 4,
                                    borderBottomLeftRadius: 4,
                                },
                            ]}
                        />
                        <View
                            style={[
                                styles.barSegment,
                                { flex: cCal, backgroundColor: colors.carbs },
                            ]}
                        />
                        <View
                            style={[
                                styles.barSegment,
                                {
                                    flex: fCal,
                                    backgroundColor: colors.fat,
                                    borderTopRightRadius: 4,
                                    borderBottomRightRadius: 4,
                                },
                            ]}
                        />
                    </View>
                    <View style={styles.legendRow}>
                        <LegendDot
                            color={colors.protein}
                            label={`${t("settings.protein")} ${Math.round((pCal / macroTotal) * 100)}%`}
                            textColor={colors.textSecondary}
                        />
                        <LegendDot
                            color={colors.carbs}
                            label={`${t("settings.carbs")} ${Math.round((cCal / macroTotal) * 100)}%`}
                            textColor={colors.textSecondary}
                        />
                        <LegendDot
                            color={colors.fat}
                            label={`${t("settings.fat")} ${Math.round((fCal / macroTotal) * 100)}%`}
                            textColor={colors.textSecondary}
                        />
                    </View>
                    <Text style={styles.breakdownSub}>
                        {t("settings.macroKcal", { kcal: Math.round(macroTotal) })}
                    </Text>
                </View>
            )}

            <Button title={t("settings.saveGoals")} onPress={handleSave} style={styles.saveBtn} />

            {/* ── Import / Export ──────────────────────────── */}
            <Text style={styles.sectionLabel}>{t("settings.data")}</Text>
            <Text style={styles.subLabel}>{t("settings.dataDescription")}</Text>
            <View style={styles.row}>
                <Button
                    title={t("settings.exportData")}
                    variant="outline"
                    onPress={handleExport}
                    loading={exporting}
                    style={{ flex: 1 }}
                />
                <Button
                    title={t("settings.importData")}
                    variant="outline"
                    onPress={handleImportConfirm}
                    loading={importing}
                    style={{ flex: 1 }}
                />
            </View>
        </ScrollView>
    );
}

function LegendDot({ color, label, textColor }: { color: string; label: string; textColor: string }) {
    return (
        <View style={legendStyles.legendItem}>
            <View style={[legendStyles.dot, { backgroundColor: color }]} />
            <Text style={[legendStyles.legendText, { color: textColor }]}>{label}</Text>
        </View>
    );
}

const legendStyles = StyleSheet.create({
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: fontSize.xs },
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: 100 },
        heading: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.lg,
        },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.md,
        },
        subLabel: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
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
        field: { marginBottom: spacing.md },
        row: {
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        thirdField: { flex: 1 },
        breakdownCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        breakdownTitle: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            marginBottom: spacing.sm,
        },
        barContainer: {
            flexDirection: "row",
            height: 10,
            borderRadius: 4,
            overflow: "hidden",
            marginBottom: spacing.sm,
        },
        barSegment: { height: 10 },
        legendRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: spacing.xs,
        },
        breakdownSub: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            textAlign: "center",
        },
        saveBtn: { marginTop: spacing.sm },
    });
}
