import { formatDateKey, getWeightLogsForRange, type WeightLog } from "@/src/features/log/services/logDb";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { spacing } from "@/src/utils/theme";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions } from "react-native";
import {
    computeStats,
    daysAgo,
    formatNum,
    type MacroKey,
    type Metric,
    type TimeSpan,
} from "../helpers/analyticsHelpers";
import { type DailyTotals, getDailyTotalsForRange } from "../services/analyticsDb";

const KG_TO_LB = 2.20462;

export function useAnalyticsData() {
    const { t } = useTranslation();
    const unitSystem = useAppStore((s) => s.unitSystem);
    const isImperial = unitSystem === "imperial";

    const [timeSpan, setTimeSpan] = useState<TimeSpan>(30);
    const [metric, setMetric] = useState<Metric>("calories");
    const [selectedMacro, setSelectedMacro] = useState<MacroKey>("protein");
    const [statsOpen, setStatsOpen] = useState(false);

    const [data, setData] = useState<DailyTotals[]>([]);
    const [weightData, setWeightData] = useState<WeightLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const id = requestAnimationFrame(() => {
            const endDate = formatDateKey(new Date());
            const startDate = timeSpan === "all" ? "2000-01-01" : daysAgo(timeSpan);
            setData(getDailyTotalsForRange(startDate, endDate));
            setWeightData(getWeightLogsForRange(startDate, endDate));
            setLoading(false);
        });
        return () => cancelAnimationFrame(id);
    }, [timeSpan]);

    // ── Statistics ──────────────────────────────────────────

    const stats = useMemo(() => {
        if (data.length === 0) return null;
        if (metric === "calories") return computeStats(data.map((d) => d.calories));
        if (metric === "macros") return computeStats(data.map((d) => d[selectedMacro]));
        if (metric === "carbs" || metric === "protein" || metric === "fat") {
            return computeStats(data.map((d) => d[metric as MacroKey]));
        }
        if (metric === "weight") {
            const byDate = new Map<string, number[]>();
            for (const w of weightData) {
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
        return null;
    }, [data, weightData, metric, selectedMacro, isImperial]);

    const statsUnit = metric === "calories" ? t("common.kcal") : metric === "weight" ? (isImperial ? "lb" : "kg") : t("common.g");
    const statsLabel = metric === "macros" ? t(`analytics.${selectedMacro}`) : t(`analytics.${metric}`);

    const handleMacroSelect = useCallback((macro: MacroKey) => {
        setSelectedMacro(macro);
    }, []);

    // ── Chart layout ───────────────────────────────────────

    const screenWidth = Dimensions.get("window").width;
    const chartContainerPadding = spacing.md * 2 + spacing.md * 2 + 2;
    const yAxisLabelWidth = 45;
    const secondaryAxisWidth = 45;
    const shouldScroll = (typeof timeSpan === "number" && timeSpan >= 90) || timeSpan === "all";

    return {
        timeSpan, setTimeSpan,
        metric, setMetric,
        selectedMacro, handleMacroSelect,
        statsOpen, setStatsOpen,
        data, weightData, loading,
        stats, statsUnit, statsLabel,
        isImperial, KG_TO_LB,
        formatNum,
        // chart layout
        screenWidth, chartContainerPadding, yAxisLabelWidth, secondaryAxisWidth, shouldScroll,
    };
}
