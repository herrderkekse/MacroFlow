import { borderRadius, type ThemeColors } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

interface ProgressTrackProps {
    value: number;
    planned: number;
    goal: number;
    color: string;
    height: number;
    colors: ThemeColors;
    /** Square ends, for a bar that runs edge to edge along a card. */
    flush?: boolean;
}

/** A goal bar: the eaten share in colour, the planned share as a ghost behind it. */
export default function ProgressTrack({ value, planned, goal, color, height, colors, flush }: ProgressTrackProps) {
    const ratio = goal > 0 ? Math.min(Math.max(value / goal, 0), 1) : 0;
    const plannedRatio = goal > 0 ? Math.min(Math.max((value + planned) / goal, 0), 1) : 0;
    const bar = { height, borderRadius: flush ? 0 : borderRadius.full };

    return (
        <View style={[styles.track, bar, { backgroundColor: colors.border }]}>
            {plannedRatio > ratio && (
                <View style={[styles.fill, bar, { width: `${plannedRatio * 100}%`, backgroundColor: colors.disabled }]} />
            )}
            <View style={[styles.fill, bar, { width: `${ratio * 100}%`, backgroundColor: color }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    track: { overflow: "hidden" },
    fill: { position: "absolute", left: 0, top: 0 },
});
