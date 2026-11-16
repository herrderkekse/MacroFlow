import { useExerciseHistory } from "@/src/features/exercise/hooks/useExerciseHistory";
import {
    copySetsFromWorkoutExercise,
    getExerciseTemplateById,
    type ExerciseTemplate,
} from "@/src/features/exercise/services/exerciseDb";
import EmptyState from "@/src/shared/atoms/EmptyState";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { parseDateKey } from "@/src/utils/date";
import { screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import ExerciseHistoryChart from "../components/ExerciseHistoryChart";
import ReadOnlyExerciseCard from "../components/ReadOnlyExerciseCard";
import SetVideoProvider from "../components/SetVideoProvider";
import { HISTORY_SPANS, type HistorySpan } from "../helpers/e1rmChart";

export default function ExerciseHistoryScreen() {
    const colors = useThemeColors();
    const { t, i18n } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const { templateId, workoutExerciseId, templateIds, workoutExerciseIds } = useLocalSearchParams<{
        templateId?: string;
        workoutExerciseId?: string;
        // Comma-separated lists, present when arriving from a superset (multiple exercises).
        templateIds?: string;
        workoutExerciseIds?: string;
    }>();

    // The exercises selectable from the header — one, or several when a superset opened this screen.
    const options = useMemo(() => {
        const tIds = templateIds ? templateIds.split(",") : templateId ? [templateId] : [];
        const wIds = workoutExerciseIds ? workoutExerciseIds.split(",") : workoutExerciseId ? [workoutExerciseId] : [];
        return tIds.map((tid, i) => ({
            templateId: Number(tid),
            workoutExerciseId: wIds[i] ? Number(wIds[i]) : undefined,
        }));
    }, [templateId, workoutExerciseId, templateIds, workoutExerciseIds]);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const active = options[selectedIndex] ?? options[0];
    const parsedId = active?.templateId;
    const parsedWeId = active?.workoutExerciseId;

    const optionTemplates = useMemo(
        () => options.map((o) => getExerciseTemplateById(o.templateId)),
        [options],
    );
    const template: ExerciseTemplate | undefined = optionTemplates[selectedIndex] ?? undefined;
    const { history, e1rmSeries, personalBest, isLoading } = useExerciseHistory(parsedId);
    const [span, setSpan] = useState<HistorySpan>(90);

    const displayUnit = (template?.default_weight_unit as "kg" | "lb") ?? "kg";

    const formatSessionDate = useCallback((dateKey: string) => {
        const date = parseDateKey(dateKey);
        const sameYear = date.getFullYear() === new Date().getFullYear();
        return date.toLocaleDateString(i18n.language, {
            weekday: "short",
            month: "short",
            day: "numeric",
            ...(sameYear ? {} : { year: "numeric" }),
        });
    }, [i18n.language]);

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
            <View style={styles.screen}>
                <ScreenHeader title="" />
                <View style={styles.center}>
                    <ActivityIndicator color={colors.textSecondary} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <ScreenHeader
                title={template?.name ?? ""}
                subtitle={t("exercise.history.title", { name: "" }).trim()}
            />

            <SetVideoProvider editable={false}>
                <FlatList
                    data={history}
                    keyExtractor={(item) => String(item.workoutExercise.id)}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <>
                            {options.length > 1 && (
                                <SegmentedControl
                                    options={options.map((_, i) => ({ key: i, label: optionTemplates[i]?.name ?? "?" }))}
                                    value={selectedIndex}
                                    onChange={setSelectedIndex}
                                    style={styles.control}
                                />
                            )}
                            {e1rmSeries.length > 0 && (
                                <>
                                    <SegmentedControl
                                        size="sm"
                                        options={HISTORY_SPANS.map((option) => ({ key: option.key, label: t(option.labelKey) }))}
                                        value={span}
                                        onChange={setSpan}
                                        style={styles.control}
                                    />
                                    <ExerciseHistoryChart
                                        series={e1rmSeries}
                                        personalBestKg={personalBest?.e1rm ?? null}
                                        span={span}
                                        unit={displayUnit}
                                        isLowerBetter={template?.resistance_mode === "assistance"}
                                    />
                                </>
                            )}
                        </>
                    }
                    renderItem={({ item }) => (
                        <>
                            <SectionLabel
                                right={parsedWeId ? (
                                    <Pressable
                                        onPress={() => handleCopySets(item.workoutExercise.id)}
                                        hitSlop={8}
                                        accessibilityLabel={t("exercise.history.copyToCurrent")}
                                    >
                                        <Ionicons name="copy-outline" size={16} color={colors.primary} />
                                    </Pressable>
                                ) : undefined}
                            >
                                {`${formatSessionDate(item.workout.date)} · ${item.workout.title || t("exercise.workout.defaultTitle")}`}
                            </SectionLabel>
                            <ReadOnlyExerciseCard item={item} />
                        </>
                    )}
                    ListEmptyComponent={<EmptyState icon="bar-chart-outline" title={t("exercise.history.noHistory")} fill />}
                />
            </SetVideoProvider>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
        listContent: { flexGrow: 1, paddingHorizontal: screenPadding, paddingTop: spacing.xs, paddingBottom: spacing.xl },
        control: { marginBottom: spacing.sm + 4 },
    });
}

