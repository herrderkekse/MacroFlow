import { getWeightLogsForRange, type WeightLog } from "@/src/features/log/services/logDb";
import { getGoalHistory, getGoals } from "@/src/features/settings/services/settingsDb";
import { useAppStore } from "@/src/shared/store/useAppStore";
import type { ChartRange } from "@/src/utils/chartScale";
import { diffDateKeys, formatDateKey } from "@/src/utils/date";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    computeStats,
    daysAgo,
    formatNum,
    KG_TO_LB,
    type MacroKey,
    type Metric,
    type TimeSpan,
} from "../helpers/analyticsHelpers";
import { WEIGHT_TREND_REACH } from "../helpers/chartSeries";
import { type DailyTotals, getDailyTotalsForRange } from "../services/analyticsDb";

/** "All" never shows less than this, so that a first week of data is not stretched across the card. */
const MIN_DAYS = 7;

interface Loaded {
    /** First and last day of the selected span; "all" starts at the first record instead. */
    startKey: string | null;
    endKey: string;
    data: DailyTotals[];
    /** Reaches back before `startKey`, so the trend is right from the first day on. */
    weightLogs: WeightLog[];
}

export function useAnalyticsData() {
    const { t, i18n } = useTranslation();
    const unitSystem = useAppStore((s) => s.unitSystem);
    const isImperial = unitSystem === "imperial";

    const [timeSpan, setTimeSpan] = useState<TimeSpan>(30);
    const [metric, setMetric] = useState<Metric>("calories");
    const [selectedMacro, setSelectedMacro] = useState<MacroKey>("protein");
    const [statsOpen, setStatsOpen] = useState(false);

    // The previous span stays on screen until the new one is read, so switching does not flash.
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [goals] = useState(getGoals);
    const [goalHistory] = useState(getGoalHistory);

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            const endKey = formatDateKey(new Date());
            const startKey = timeSpan === "all" ? null : daysAgo(timeSpan - 1);
            setLoaded({
                startKey,
                endKey,
                data: getDailyTotalsForRange(startKey ?? "2000-01-01", endKey),
                weightLogs: getWeightLogsForRange(
                    timeSpan === "all" ? "2000-01-01" : daysAgo(timeSpan - 1 + WEIGHT_TREND_REACH),
                    endKey,
                ),
            });
        });
        return () => cancelAnimationFrame(id);
    }, [timeSpan]);

    const data = useMemo(() => loaded?.data ?? [], [loaded]);
    const weightLogs = useMemo(() => loaded?.weightLogs ?? [], [loaded]);

    // ── Time axis ───────────────────────────────────────────

    const range = useMemo((): ChartRange | null => {
        if (!loaded) return null;
        let startKey = loaded.startKey;
        if (!startKey) {
            const first = metric === "weight" ? loaded.weightLogs[0]?.date : loaded.data[0]?.date;
            if (!first) return null;
            const earliest = daysAgo(MIN_DAYS - 1);
            startKey = first < earliest ? first : earliest;
        }
        return { startKey, days: diffDateKeys(loaded.endKey, startKey) + 1 };
    }, [loaded, metric]);

    // ── Statistics ──────────────────────────────────────────

    const stats = useMemo(() => {
        if (metric === "weight") {
            const byDate = new Map<string, number[]>();
            for (const w of weightLogs) {
                if (range && w.date < range.startKey) continue;
                const arr = byDate.get(w.date) ?? [];
                arr.push(w.weight_kg);
                byDate.set(w.date, arr);
            }
            const conversionFactor = isImperial ? KG_TO_LB : 1;
            const dailyAvgs = Array.from(byDate.values()).map(
                (vals) => (vals.reduce((a, b) => a + b, 0) / vals.length) * conversionFactor
            );
            return computeStats(dailyAvgs);
        }
        if (data.length === 0) return null;
        if (metric === "calories") return computeStats(data.map((d) => d.calories));
        if (metric === "macros") return computeStats(data.map((d) => d[selectedMacro]));
        return computeStats(data.map((d) => d[metric]));
    }, [data, weightLogs, range, metric, selectedMacro, isImperial]);

    const statsUnit = metric === "calories" ? t("common.kcal") : metric === "weight" ? (isImperial ? "lb" : "kg") : t("common.g");
    const statsLabel = metric === "macros" ? t(`analytics.${selectedMacro}`) : t(`analytics.${metric}`);

    // The same number format as the chart's figures above the statistics. Calories
    // are whole numbers: a tenth of a kcal says nothing, and four figures with a
    // thousands separator leave no room for it.
    const defaultDecimals = metric === "calories" ? 0 : 1;
    const formatLocal = useCallback(
        (value: number, decimals = defaultDecimals) => formatNum(value, decimals, i18n.language),
        [i18n.language, defaultDecimals],
    );

    const handleMacroSelect = useCallback((macro: MacroKey) => {
        setSelectedMacro(macro);
    }, []);

    return {
        timeSpan, setTimeSpan,
        metric, setMetric,
        selectedMacro, handleMacroSelect,
        statsOpen, setStatsOpen,
        data, weightLogs, range, goals, goalHistory,
        loading: loaded === null,
        stats, statsUnit, statsLabel,
        isImperial,
        formatNum: formatLocal,
    };
}
