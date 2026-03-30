import { addEntry, addFood, formatDateKey, getEntriesByDate, getGoals, setGoals } from "@/src/db/queries";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

export default function DbTestScreen() {
    const { t } = useTranslation();
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
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>{t("dbTest.title")}</Text>
            <Pressable style={styles.button} onPress={runTest}>
                <Text style={styles.buttonText}>{t("dbTest.run")}</Text>
            </Pressable>
            {logs.map((l, i) => (
                <Text key={i} style={styles.log}>
                    {l}
                </Text>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 24, paddingTop: 60 },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
    button: {
        backgroundColor: "#2563eb",
        padding: 12,
        borderRadius: 8,
        alignItems: "center",
        marginBottom: 16,
    },
    buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
    log: { fontSize: 12, marginBottom: 4, fontFamily: "monospace" },
});
