import type { Goals } from "@/src/features/settings/services/settingsDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React from "react";
import { splitEatenPlanned, type MacroTotals } from "../helpers/logHelpers";
import ProgressTrack from "./ProgressTrack";

interface DayCalorieBarProps {
    totals: MacroTotals;
    scheduledTotals?: MacroTotals;
    goals: Goals;
}

/** Calories against the goal, as a thin bar along the bottom edge of the log's summary card. */
export default function DayCalorieBar({ totals, scheduledTotals, goals }: DayCalorieBarProps) {
    const colors = useThemeColors();
    const { eaten, planned } = splitEatenPlanned(totals, scheduledTotals);
    const isOver = goals.calories > 0 && eaten.calories > goals.calories;

    return (
        <ProgressTrack
            value={eaten.calories}
            planned={planned.calories}
            goal={goals.calories}
            color={isOver ? colors.danger : colors.calories}
            height={6}
            colors={colors}
            flush
        />
    );
}
