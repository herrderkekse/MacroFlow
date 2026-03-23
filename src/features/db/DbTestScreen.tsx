import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { addFood, addEntry, getEntriesByDate, getGoals, setGoals } from "@/src/db/queries";

export default function DbTestScreen() {
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) =>
        setLogs((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev]);

    function runTest() {
        try {
            log("Adding test food…");
            const food = addFood({
                name: "Test Oats",
                calories_per_100g: 389,
                protein_per_100g: 16.9,
                carbs_per_100g: 66.3,
                fat_per_100g: 6.9,
            });
            log(`Added food id=${food.id} name=${food.name}`);

            log("Adding test entry…");
            const entry = addEntry({
                food_id: food.id,
                quantity_grams: 50,
                timestamp: Date.now(),
                meal_type: "breakfast",
                date: new Date().toISOString().split("T")[0],
            });
            log(`Added entry id=${entry.id}`);

            log("Querying today's entries…");
            const rows = getEntriesByDate(new Date());
            log(`Found ${rows.length} entries`);
            rows.forEach((r) =>
                log(`  entry=${r.entries.id} food=${r.foods?.name ?? "—"} qty=${r.entries.quantity_grams}g`)
            );

            log("Testing goals…");
            setGoals({ calories: 2100 });
            const g = getGoals();
            log(`Goals: cal=${g?.calories} p=${g?.protein} c=${g?.carbs} f=${g?.fat}`);

            log("✓ All tests passed");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            log(`✗ Test failed: ${msg}`);
        }
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>DB End-to-End Test</Text>
            <Pressable style={styles.button} onPress={runTest}>
                <Text style={styles.buttonText}>Run DB Test</Text>
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
