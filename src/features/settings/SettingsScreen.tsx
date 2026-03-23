import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    Alert,
} from "react-native";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";
import { getGoals, setGoals, type Goals } from "@/src/db/queries";
import { useAppStore } from "@/src/store/useAppStore";
import type { UnitSystem } from "@/src/types";
import Input from "@/src/components/Input";
import Button from "@/src/components/Button";
import { exportData, importData } from "@/src/services/importExport";

const UNIT_OPTIONS: { key: UnitSystem; label: string }[] = [
    { key: "metric", label: "Metric (g, ml)" },
    { key: "imperial", label: "Imperial (oz, cup)" },
];

export default function SettingsScreen() {
    const unitSystem = useAppStore((s) => s.unitSystem);
    const setUnitSystem = useAppStore((s) => s.setUnitSystem);

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
            Alert.alert("Invalid", "Calories must be greater than 0");
            return;
        }

        setGoals({
            calories: cal,
            protein: p,
            carbs: c,
            fat: f,
            unit_system: unitSystem,
        });
        Alert.alert("Saved", "Your goals have been updated.");
    }

    function handleUnitChange(system: UnitSystem) {
        setUnitSystem(system);
        setGoals({ unit_system: system });
    }

    // ── Import / Export ─────────────────────────────────
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    async function handleExport() {
        try {
            setExporting(true);
            await exportData();
        } catch (e: any) {
            Alert.alert("Export failed", e.message ?? "Unknown error");
        } finally {
            setExporting(false);
        }
    }

    function handleImportConfirm() {
        Alert.alert(
            "Import Data",
            "This will replace ALL current data with the contents of the backup file. This cannot be undone.\n\nContinue?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Import", style: "destructive", onPress: handleImport },
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
            Alert.alert("Import complete", `${inserted} records restored.`);
        } catch (e: any) {
            if (e.message !== "cancelled") {
                Alert.alert("Import failed", e.message ?? "Unknown error");
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
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.heading}>Settings</Text>

            {/* ── Unit System ─────────────────────────────── */}
            <Text style={styles.sectionLabel}>PREFERRED UNITS</Text>
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
            <Text style={styles.sectionLabel}>DAILY GOALS</Text>

            <Input
                label="Calories"
                value={calories}
                onChangeText={setCalories}
                keyboardType="decimal-pad"
                suffix="kcal"
                containerStyle={styles.field}
            />

            {/* ── Macro Goals ─────────────────────────────── */}
            <Text style={styles.subLabel}>Macronutrient targets (grams)</Text>

            <View style={styles.row}>
                <Input
                    label="Protein"
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="decimal-pad"
                    suffix="g"
                    containerStyle={styles.thirdField}
                />
                <Input
                    label="Carbs"
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="decimal-pad"
                    suffix="g"
                    containerStyle={styles.thirdField}
                />
                <Input
                    label="Fat"
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="decimal-pad"
                    suffix="g"
                    containerStyle={styles.thirdField}
                />
            </View>

            {/* Macro breakdown preview */}
            {macroTotal > 0 && (
                <View style={styles.breakdownCard}>
                    <Text style={styles.breakdownTitle}>Macro Breakdown</Text>
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
                            label={`Protein ${Math.round((pCal / macroTotal) * 100)}%`}
                        />
                        <LegendDot
                            color={colors.carbs}
                            label={`Carbs ${Math.round((cCal / macroTotal) * 100)}%`}
                        />
                        <LegendDot
                            color={colors.fat}
                            label={`Fat ${Math.round((fCal / macroTotal) * 100)}%`}
                        />
                    </View>
                    <Text style={styles.breakdownSub}>
                        {Math.round(macroTotal)} kcal from macros
                    </Text>
                </View>
            )}

            <Button title="Save Goals" onPress={handleSave} style={styles.saveBtn} />

            {/* ── Import / Export ──────────────────────────── */}
            <Text style={styles.sectionLabel}>DATA</Text>
            <Text style={styles.subLabel}>
                Export a full backup of your foods, entries, recipes and goals, or import a previously exported file.
            </Text>
            <View style={styles.row}>
                <Button
                    title="Export Data"
                    variant="outline"
                    onPress={handleExport}
                    loading={exporting}
                    style={{ flex: 1 }}
                />
                <Button
                    title="Import Data"
                    variant="outline"
                    onPress={handleImportConfirm}
                    loading={importing}
                    style={{ flex: 1 }}
                />
            </View>
        </ScrollView>
    );
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
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
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: fontSize.xs, color: colors.textSecondary },
    breakdownSub: {
        fontSize: fontSize.xs,
        color: colors.textTertiary,
        textAlign: "center",
    },
    saveBtn: { marginTop: spacing.sm },
});
