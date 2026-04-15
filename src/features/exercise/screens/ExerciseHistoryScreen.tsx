import { useExerciseHistory } from "@/src/features/exercise/hooks/useExerciseHistory";
import { getExerciseTemplateById, type ExerciseTemplate } from "@/src/features/exercise/services/exerciseDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { kgToLb } from "../helpers/exerciseUnits";
import { formatRirRange, formatSetSummary } from "../helpers/workoutSummary";

export default function ExerciseHistoryScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { templateId } = useLocalSearchParams<{ templateId: string }>();
    const parsedId = templateId ? Number(templateId) : undefined;

    const template: ExerciseTemplate | undefined = useMemo(
        () => (parsedId ? getExerciseTemplateById(parsedId) : undefined),
        [parsedId],
    );
    const { history, e1rmSeries, personalBest, isLoading } = useExerciseHistory(parsedId);

    const isAssistance = template?.resistance_mode === "assistance";
    const displayUnit = (template?.default_weight_unit as "kg" | "lb") ?? "kg";
    const toDisplayUnit = (kgValue: number) =>
        displayUnit === "lb" ? kgToLb(kgValue) : Math.round(kgValue * 10) / 10;

    const chartData = useMemo(() => {
        if (e1rmSeries.length === 0) return [];
        return e1rmSeries.map((point, i) => ({
            value: toDisplayUnit(point.e1rm),
            label: i % Math.max(1, Math.floor(e1rmSeries.length / 6)) === 0
                ? point.date.slice(5)
                : "",
            labelTextStyle: { color: colors.textSecondary, fontSize: 9 },
        }));
    }, [e1rmSeries, colors.textSecondary]);

    const pbE1rm = personalBest ? toDisplayUnit(personalBest.e1rm) : null;
    const currentE1rm = e1rmSeries.length > 0
        ? toDisplayUnit(e1rmSeries[e1rmSeries.length - 1].e1rm)
        : null;

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
                                    width={280}
                                    spacing={chartData.length > 1 ? 280 / (chartData.length - 1) : 280}
                                    hideDataPoints={chartData.length > 12}
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
                            </View>
                        )}

                        {history.length > 0 && (
                            <Text style={styles.sectionHeader}>
                                {t("exercise.history.title", { name: "" }).trim()}
                            </Text>
                        )}
                    </>
                }
                renderItem={({ item }) => {
                    const summary = formatSetSummary(item.sets);
                    const rir = formatRirRange(item.sets);
                    return (
                        <View style={styles.historyRow}>
                            <Text style={styles.historyDate}>
                                {item.workout.date}
                            </Text>
                            <Text style={styles.historySummary} numberOfLines={1}>
                                {summary}
                                {rir ? `  ${rir}` : ""}
                            </Text>
                        </View>
                    );
                }}
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
        statText: { fontSize: fontSize.sm, color: colors.textSecondary },
        sectionHeader: {
            fontSize: fontSize.xs,
            fontWeight: "700",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginTop: spacing.sm,
            marginBottom: spacing.sm,
        },
        historyRow: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
        },
        historyDate: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            marginBottom: 2,
        },
        historySummary: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        emptyText: {
            fontSize: fontSize.md,
            color: colors.textTertiary,
            marginTop: spacing.sm,
        },
    });
}

