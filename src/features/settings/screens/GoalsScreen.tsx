import Button from "@/src/shared/atoms/Button";
import Card from "@/src/shared/atoms/Card";
import Input from "@/src/shared/atoms/Input";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import FooterBar from "@/src/shared/components/FooterBar";
import MacroSplitBar from "@/src/shared/components/MacroSplitBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { formatDateKey } from "@/src/utils/date";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { getGoals, setNutritionGoals } from "../services/settingsDb";

export default function GoalsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [calories, setCalories] = useState("2000");
    const [protein, setProtein] = useState("150");
    const [carbs, setCarbs] = useState("250");
    const [fat, setFat] = useState("70");

    useEffect(() => {
        queueMicrotask(() => {
            const g = getGoals();
            if (g) {
                setCalories(String(g.calories));
                setProtein(String(g.protein));
                setCarbs(String(g.carbs));
                setFat(String(g.fat));
            }
        });
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

        setNutritionGoals({ calories: cal, protein: p, carbs: c, fat: f }, formatDateKey(new Date()));
        Alert.alert(t("settings.saved"), t("settings.goalsUpdated"));
    }

    const proteinGrams = parseFloat(protein) || 0;
    const carbGrams = parseFloat(carbs) || 0;
    const fatGrams = parseFloat(fat) || 0;
    const macroTotal = proteinGrams * 4 + carbGrams * 4 + fatGrams * 9;

    return (
        <View style={styles.screen}>
            <ScreenHeader title={t("more.goals")} />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <SectionLabel style={styles.firstLabel}>{t("settings.dailyGoals")}</SectionLabel>

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
                    <>
                        <SectionLabel>{t("settings.macroBreakdown")}</SectionLabel>
                        <Card>
                            <MacroSplitBar protein={proteinGrams} carbs={carbGrams} fat={fatGrams} />
                            <Text style={styles.breakdownSub}>
                                {t("settings.macroKcal", { kcal: Math.round(macroTotal) })}
                            </Text>
                        </Card>
                    </>
                )}
            </ScrollView>
            <FooterBar>
                <Button title={t("settings.saveGoals")} onPress={handleSave} />
            </FooterBar>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl },
        firstLabel: { marginTop: spacing.sm },
        field: { marginBottom: spacing.md },
        row: { flexDirection: "row", gap: spacing.sm },
        thirdField: { flex: 1 },
        breakdownSub: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.sm },
    });
}
