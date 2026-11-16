import type { WeightLog } from "@/src/features/log/services/logDb";
import type { NutritionGoals } from "@/src/features/settings/services/settingsDb";
import TimeSeriesChart from "@/src/shared/components/TimeSeriesChart";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import type { ChartRange } from "@/src/utils/chartScale";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { KG_TO_LB, type Metric } from "../helpers/analyticsHelpers";
import { buildChartModel } from "../helpers/chartModel";
import type { DailyTotals } from "../services/analyticsDb";

interface AnalyticsChartProps {
    metric: Metric;
    /** The days on the time axis; null when there is nothing to put on it. */
    range: ChartRange | null;
    data: DailyTotals[];
    /** May reach back before the range, for the trend. */
    weightLogs: WeightLog[];
    goals: NutritionGoals | undefined;
    goalHistory: (NutritionGoals & { date: string })[];
    isImperial: boolean;
    loading: boolean;
}

/** The trends chart: the selected metric over the selected span. */
export default function AnalyticsChart({
    metric, range, data, weightLogs, goals, goalHistory, isImperial, loading,
}: AnalyticsChartProps) {
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();

    const build = useCallback(
        (plotWidth: number) =>
            range &&
            buildChartModel({
                metric, range, data, weightLogs, goals, goalHistory,
                weightUnit: isImperial ? "lb" : "kg",
                weightFactor: isImperial ? KG_TO_LB : 1,
                plotWidth,
                colors,
                locale: i18n.language,
                t,
            }),
        [metric, range, data, weightLogs, goals, goalHistory, isImperial, colors, i18n.language, t],
    );

    return <TimeSeriesChart build={build} title={t(`analytics.${metric}`)} emptyTitle={t("analytics.noData")} loading={loading} />;
}
