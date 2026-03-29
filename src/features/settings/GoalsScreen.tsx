import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { getGoals, setGoals } from "@/src/db/queries";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GoalsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

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

        setGoals({ calories: cal, protein: p, carbs: c, fat: f });
        Alert.alert(t("settings.saved"), t("settings.goalsUpdated"));
    }

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
            <View style={styles.headerRow}>
                <Pressable onPress={() => router.navigate("/(tabs)/more" as any)} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </Pressable>
                <Text style={styles.heading}>{t("more.goals")}</Text>
            </View>

            <Text style={styles.sectionLabel}>{t("settings.dailyGoals")}</Text>

            <Input
                label={t("settings.calories")}
                value={calories}
                onChangeText={setCalories}
                keyboardType="decimal-pad"
                suffix={t("common.kcal")}
                containerStyle={styles.field}
            />

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
                            style={[styles.barSegment, { flex: cCal, backgroundColor: colors.carbs }]}
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
