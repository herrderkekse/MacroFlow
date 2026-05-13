import { useExerciseHistory } from "@/src/features/exercise/hooks/useExerciseHistory";
import {
    copySetsFromWorkoutExercise,
    getExerciseTemplateById,
    type ExerciseTemplate,
} from "@/src/features/exercise/services/exerciseDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { kgToLb } from "../helpers/exerciseUnits";
import oneRepMax from "../helpers/oneRepMax";
import ReadOnlyExerciseCard from "../components/ReadOnlyExerciseCard";

export default function ExerciseHistoryScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { width: windowWidth } = useWindowDimensions();
    const router = useRouter();
    const { templateId, workoutExerciseId } = useLocalSearchParams<{
        templateId: string;
        workoutExerciseId?: string;
    }>();
    const parsedId = templateId ? Number(templateId) : undefined;
    const parsedWeId = workoutExerciseId ? Number(workoutExerciseId) : undefined;

    const template: ExerciseTemplate | undefined = useMemo(
        () => (parsedId ? getExerciseTemplateById(parsedId) : undefined),
        [parsedId],
    );
    const { history, e1rmSeries, personalBest, isLoading } = useExerciseHistory(parsedId);
    const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

    const isAssistance = template?.resistance_mode === "assistance";
    const displayUnit = (template?.default_weight_unit as "kg" | "lb") ?? "kg";
    const toDisplayUnit = useCallback((kgValue: number) => {
        return displayUnit === "lb" ? kgToLb(kgValue) : Math.round(kgValue * 10) / 10;
    }, [displayUnit]);

    const formatDisplayValue = useCallback((value: number) => {
        const rounded = Math.round(value * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }, []);

    const chartWidth = useMemo(() => {
        const horizontalPadding = spacing.md * 4;
        return Math.max(200, windowWidth - horizontalPadding);
    }, [windowWidth]);

    const chartData = useMemo(() => {
        if (e1rmSeries.length === 0) return [];
        return e1rmSeries.map((point, i) => ({
            value: toDisplayUnit(point.e1rm),
            label: i % Math.max(1, Math.floor(e1rmSeries.length / 6)) === 0
                ? point.date.slice(5)
                : "",
            labelTextStyle: { color: colors.textSecondary, fontSize: 9 },
            onPress: () => setSelectedPointIndex((prev) => (prev === i ? null : i)),
            dataPointColor: selectedPointIndex === i ? colors.success : colors.primary,
            dataPointRadius: selectedPointIndex === i ? 7 : 5,
        }));
    }, [e1rmSeries, colors.textSecondary, colors.success, colors.primary, selectedPointIndex, toDisplayUnit]);
    const chartSpacing = chartData.length > 1 ? chartWidth / (chartData.length - 1) : chartWidth;

    const selectedPointDetails = useMemo(() => {
        if (selectedPointIndex === null || selectedPointIndex < 0 || selectedPointIndex >= e1rmSeries.length) {
            return null;
        }

        const point = e1rmSeries[selectedPointIndex];
        const entriesForDate = history.filter((entry) => entry.workout.date === point.date);

        let bestSet: { weightKg: number; reps: number; e1rm: number } | null = null;
        for (const entry of entriesForDate) {
            for (const set of entry.sets) {
                if (!set.completed_at || set.weight === null || set.reps === null || set.reps <= 0) continue;

                const weightKg = oneRepMax.toKg(set.weight, set.weight_unit);
                const setE1rm = oneRepMax.toEstimated1RM(weightKg, set.reps);
                const currentBest = bestSet?.e1rm ?? null;

                if (oneRepMax.isBetterPerformance(setE1rm, currentBest, template?.resistance_mode ?? "resistance")) {
                    bestSet = { weightKg, reps: set.reps, e1rm: setE1rm };
                }
            }
        }

        return {
            dateLabel: point.date,
            e1rm: formatDisplayValue(toDisplayUnit(point.e1rm)),
            bestSetLabel: bestSet
                ? `${formatDisplayValue(toDisplayUnit(bestSet.weightKg))} ${displayUnit} x ${bestSet.reps}`
                : null,
        };
    }, [selectedPointIndex, e1rmSeries, history, template?.resistance_mode, formatDisplayValue, displayUnit, toDisplayUnit]);

    const pbE1rm = personalBest ? toDisplayUnit(personalBest.e1rm) : null;
    const currentE1rm = e1rmSeries.length > 0
        ? toDisplayUnit(e1rmSeries[e1rmSeries.length - 1].e1rm)
        : null;

    const selectedPointLayout = useMemo(() => {
        if (!selectedPointDetails || selectedPointIndex === null || chartData.length === 0) return null;

        const value = chartData[selectedPointIndex]?.value;
        if (value === undefined) return null;

        const values = chartData.map((point) => point.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue;

        const x = chartData.length === 1 ? chartWidth / 2 : selectedPointIndex * chartSpacing;
        const normalized = range > 0 ? (value - minValue) / range : 0.5;
        const y = 8 + (1 - normalized) * (160 - 16);

        const tooltipWidth = 156;
        const tooltipHeight = selectedPointDetails.bestSetLabel ? 54 : 38;
        const tooltipLeft = Math.max(0, Math.min(chartWidth - tooltipWidth, x - tooltipWidth / 2));
        const tooltipTop = Math.max(0, y - tooltipHeight - 12);

        return {
            tooltipWidth,
            tooltipTop,
            tooltipLeft,
            stemLeft: Math.max(tooltipLeft + 8, Math.min(tooltipLeft + tooltipWidth - 8, x)),
            stemHeight: Math.max(6, y - (tooltipTop + tooltipHeight)),
        };
    }, [selectedPointDetails, selectedPointIndex, chartData, chartWidth, chartSpacing]);

    const handleCopySets = useCallback((sourceWeId: number) => {
        if (!parsedWeId) return;
        const count = copySetsFromWorkoutExercise(sourceWeId, parsedWeId);
        if (count > 0) {
            Alert.alert(t("exercise.history.copiedSets", { count }));
            router.back();
        } else {
            Alert.alert(t("exercise.history.noSetsInSession"));
        }
    }, [parsedWeId, t, router]);

    if (isLoading) {
        return (
            <View style={[styles.screen, styles.center]}>
                <Stack.Screen options={{ title: "" }} />
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <Stack.Screen
                options={{ title: t("exercise.history.title", { name: template?.name ?? "" }) }}
            />

            <FlatList
                data={history}
                keyExtractor={(item) => String(item.workoutExercise.id)}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        {chartData.length > 0 && (
                            <View style={styles.chartCard}>
                                <Text style={styles.chartTitle}>
                                    {t("exercise.history.estimated1RM")}
                                    {isAssistance ? " ↓" : ""}
                                </Text>
                                <View style={styles.statsRow}>
                                    {currentE1rm !== null && (
                                        <Text style={styles.statText}>
                                            {t("exercise.history.current")}: {currentE1rm} {displayUnit}
                                        </Text>
                                    )}
                                    {pbE1rm !== null && (
                                        <Text style={[styles.statText, { color: colors.success }]}>
                                            {t("exercise.history.personalBest")}: {pbE1rm} {displayUnit}
                                        </Text>
                                    )}
                                </View>
                                <View style={[styles.chartArea, { width: chartWidth }]}> 
                                    <LineChart
                                        data={chartData}
                                        color={colors.primary}
                                        startFillColor={colors.primary}
                                        endFillColor={colors.background}
                                        startOpacity={0.3}
                                        endOpacity={0.01}
                                        areaChart
                                        curved
                                        thickness={2}
                                        height={160}
                                        width={chartWidth}
                                        spacing={chartSpacing}
                                        hideDataPoints={false}
                                        dataPointsColor={colors.primary}
                                        yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                                        xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
                                        yAxisColor={colors.border}
                                        xAxisColor={colors.border}
                                        rulesColor={colors.border}
                                        noOfSections={4}
                                        animateOnDataChange
                                        isAnimated
                                    />
                                    {selectedPointDetails && selectedPointLayout && (
                                        <>
                                            <View
                                                style={[
                                                    styles.selectedTooltip,
                                                    {
                                                        width: selectedPointLayout.tooltipWidth,
                                                        left: selectedPointLayout.tooltipLeft,
                                                        top: selectedPointLayout.tooltipTop,
                                                    },
                                                ]}
                                            >
                                                <Text style={styles.selectedTooltipTitle} numberOfLines={1}>
                                                    {selectedPointDetails.e1rm} {displayUnit}
                                                </Text>
                                                {selectedPointDetails.bestSetLabel && (
                                                    <Text style={styles.selectedTooltipSubtitle} numberOfLines={1}>
                                                        {selectedPointDetails.bestSetLabel}
                                                    </Text>
                                                )}
                                            </View>
                                            <View
                                                style={[
                                                    styles.selectedTooltipStem,
                                                    {
                                                        left: selectedPointLayout.stemLeft,
                                                        top: selectedPointLayout.tooltipTop + (selectedPointDetails.bestSetLabel ? 54 : 38),
                                                        height: selectedPointLayout.stemHeight,
                                                    },
                                                ]}
                                            />
                                        </>
                                    )}
                                </View>
                                <Text style={styles.chartHintText}>
                                    {selectedPointDetails
                                        ? `${t("exercise.history.selectedPoint")}: ${selectedPointDetails.dateLabel}`
                                        : t("exercise.history.tapPointHint")}
                                </Text>
                            </View>
                        )}

                        {history.length > 0 && (
                            <Text style={styles.sectionHeader}>
                                {t("exercise.history.title", { name: "" }).trim()}
                            </Text>
                        )}
                    </>
                }
                renderItem={({ item }) => (
                    <ReadOnlyExerciseCard
                        item={item}
                        onCopy={parsedWeId ? () => handleCopySets(item.workoutExercise.id) : undefined}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.center}>
                        <Ionicons name="bar-chart-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>
                            {t("exercise.history.noHistory")}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
        listContent: { padding: spacing.md },
        chartCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        chartTitle: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
            marginBottom: spacing.xs,
        },
        statsRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
        },
        chartArea: {
            position: "relative",
            alignSelf: "center",
        },
        selectedTooltip: {
            position: "absolute",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
        },
        selectedTooltipTitle: {
            fontSize: fontSize.sm,
            color: colors.text,
            fontWeight: "700",
            textAlign: "center",
        },
        selectedTooltipSubtitle: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginTop: 2,
            textAlign: "center",
        },
        selectedTooltipStem: {
            position: "absolute",
            width: 2,
            marginLeft: -1,
            backgroundColor: colors.success,
            borderRadius: 1,
        },
        chartHintText: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginTop: spacing.xs,
        },
        statText: { fontSize: fontSize.sm, color: colors.textSecondary },
        sectionHeader: {
            fontSize: fontSize.xs,
            fontWeight: "700",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginTop: spacing.sm,
            marginBottom: spacing.sm,
        },
        emptyText: {
            fontSize: fontSize.md,
            color: colors.textTertiary,
            marginTop: spacing.sm,
        },
    });
}

