import TimeSeriesChart from "@/src/shared/components/TimeSeriesChart";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildE1rmModel, historyRange, type HistorySpan } from "../helpers/e1rmChart";
import type { Estimated1RMPoint } from "../services/exerciseStatsDb";

interface ExerciseHistoryChartProps {
    series: Estimated1RMPoint[];
    /** The best estimated one-rep maximum ever, in kilograms. */
    personalBestKg: number | null;
    span: HistorySpan;
    unit: "kg" | "lb";
    isLowerBetter: boolean;
}

/** An exercise's estimated one-rep maximum over the selected span. */
export default function ExerciseHistoryChart({ series, personalBestKg, span, unit, isLowerBetter }: ExerciseHistoryChartProps) {
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const range = useMemo(() => historyRange(span, series), [span, series]);

    const build = useCallback(
        (plotWidth: number) =>
            range &&
            buildE1rmModel({
                series, personalBestKg, range, unit, isLowerBetter, plotWidth,
                color: colors.exercise,
                locale: i18n.language,
                t,
            }),
        [series, personalBestKg, range, unit, isLowerBetter, colors.exercise, i18n.language, t],
    );

    return (
        <TimeSeriesChart
            build={build}
            title={t("exercise.history.estimated1RM")}
            emptyTitle={t("exercise.history.noSessionsInSpan")}
        />
    );
}
