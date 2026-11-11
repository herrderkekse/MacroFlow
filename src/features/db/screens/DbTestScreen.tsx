import { addEntry, formatDateKey, getEntriesByDate } from "@/src/features/log/services/logDb";
import { getGoals, setGoals } from "@/src/features/settings/services/settingsDb";
import { addFood } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing } from "@/src/utils/theme";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function DbTestScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) =>
        setLogs((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev]);

    function runTest() {
        try {
            log(t("dbTest.addingTestFood"));
            const food = addFood({
                name: "Test Oats",
                calories_per_100g: 389,
                protein_per_100g: 16.9,
                carbs_per_100g: 66.3,
                fat_per_100g: 6.9,
            });
            log(t("dbTest.addedFood", { id: food.id, name: food.name }));

            log(t("dbTest.addingTestEntry"));
            const entry = addEntry({
                food_id: food.id,
                quantity_grams: 50,
                timestamp: Date.now(),
                meal_type: "breakfast",
                date: formatDateKey(new Date()),
            });
            log(t("dbTest.addedEntry", { id: entry.id }));

            log(t("dbTest.queryingEntries"));
            const rows = getEntriesByDate(new Date());
            log(t("dbTest.foundEntries", { count: rows.length }));
            rows.forEach((r) =>
                log(t("dbTest.entryRow", {
                    entryId: r.entries.id,
                    foodName: r.foods?.name ?? "—",
                    quantity: r.entries.quantity_grams,
                }))
            );

            log(t("dbTest.testingGoals"));
            setGoals({ calories: 2100 });
            const g = getGoals();
            log(t("dbTest.goals", {
                calories: g?.calories,
                protein: g?.protein,
                carbs: g?.carbs,
                fat: g?.fat,
            }));

            log(t("dbTest.success"));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            log(t("dbTest.failure", { message: msg }));
        }
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScreenHeader title={t("dbTest.title")} />
            <ScrollView contentContainerStyle={styles.content}>
                <Button title={t("dbTest.run")} onPress={runTest} style={styles.button} />
                {logs.map((l, i) => (
                    <Text key={i} style={[styles.log, { color: colors.textSecondary }]}>
                        {l}
                    </Text>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xl },
    button: { marginBottom: spacing.md },
    log: { fontSize: fontSize.xs, marginBottom: spacing.xs, fontFamily: "monospace" },
});
