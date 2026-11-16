import Chip from "@/src/shared/atoms/Chip";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import ChipRow from "@/src/shared/components/ChipRow";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { TIMER_MAX_SECONDS, TIMER_MIN_SECONDS, type ClockMode, type DurationClock } from "../hooks/useDurationClock";
import RestDurationStepper from "./RestDurationStepper";

// What the workout's pinned card shows on each of its pages: a reading row
// (icon, figure, label, actions), the bar under it, and the details behind
// its chevron.

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const REST_PRESETS = [30, 60, 120, 180, 240, 300];
const TIMER_PRESETS = [30, 60, 120, 300, 600, 1800];

function useStyles() {
    const colors = useThemeColors();
    return { colors, styles: useMemo(() => createStyles(colors), [colors]) };
}

function formatPreset(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    return seconds % 60 === 0 ? `${seconds / 60}m` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** A page's summary: icon, the figure, what it is, and the page's actions on the right. */
export function Reading({ icon, value, label, tint, children }: {
    icon: IconName;
    value: string;
    label: string;
    /** Colors icon and figure (a rest that has run over, a timer that is up). */
    tint?: string;
    children?: React.ReactNode;
}) {
    const { colors, styles } = useStyles();
    return (
        <View style={styles.reading}>
            <Ionicons name={icon} size={18} color={tint ?? colors.text} />
            <View style={styles.figure}>
                <Text style={[styles.value, tint ? { color: tint } : null]}>{value}</Text>
                <Text style={styles.label} numberOfLines={1}>{label}</Text>
            </View>
            {children}
        </View>
    );
}

/** The bar along the card's bottom edge. */
export function Track({ fill, color }: { fill: number; color?: string }) {
    const { colors, styles } = useStyles();
    const width = `${Math.min(1, Math.max(0, fill)) * 100}%` as const;
    return (
        <View style={styles.track}>
            <View style={[styles.fill, { width, backgroundColor: color ?? colors.primary }]} />
        </View>
    );
}

/** A duration picked from presets or set to the second with the stepper. */
function DurationPicker({ label, presets, seconds, onChange, min, max }: {
    label: string; presets: number[]; seconds: number; onChange: (seconds: number) => void; min?: number; max?: number;
}) {
    const { styles } = useStyles();
    return (
        <View style={styles.details}>
            <SectionLabel style={styles.sectionLabel}>{label}</SectionLabel>
            {/* Chips, not segments: after a ±15 s step no preset is selected. */}
            <ChipRow scroll bleed={spacing.md}>
                {presets.map((p) => (
                    <Chip key={p} label={formatPreset(p)} selected={seconds === p} onPress={() => onChange(p)} />
                ))}
            </ChipRow>
            <RestDurationStepper seconds={seconds} onChange={onChange} min={min} max={max} />
        </View>
    );
}

export function RestDetails({ seconds, onChange }: { seconds: number; onChange: (seconds: number) => void }) {
    const { t } = useTranslation();
    return (
        <DurationPicker label={t("exercise.restTimer.duration")} presets={REST_PRESETS} seconds={seconds} onChange={onChange} />
    );
}

/** Stopwatch or timer, and the timer's length; only while the clock is not going. */
export function ClockDetails({ clock }: { clock: DurationClock }) {
    const { t } = useTranslation();
    const { styles } = useStyles();
    return (
        <View style={styles.details}>
            <SegmentedControl<ClockMode>
                options={[
                    { key: "stopwatch", label: t("exercise.durationClock.stopwatch"), icon: "stopwatch-outline" },
                    { key: "timer", label: t("exercise.durationClock.timer"), icon: "timer-outline" },
                ]}
                value={clock.mode}
                onChange={clock.setMode}
            />
            {clock.mode === "timer" && (
                <DurationPicker
                    label={t("exercise.durationClock.timerLength")}
                    presets={TIMER_PRESETS}
                    seconds={clock.timerSeconds}
                    onChange={clock.setTimerSeconds}
                    min={TIMER_MIN_SECONDS}
                    max={TIMER_MAX_SECONDS}
                />
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        reading: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
        figure: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: spacing.xs + 2 },
        value: { fontSize: fontSize.xl - 1, fontWeight: "600", letterSpacing: -0.5, color: colors.text, fontVariant: ["tabular-nums"] },
        label: { flexShrink: 1, fontSize: fontSize.xs, color: colors.textTertiary },
        track: { height: 5, backgroundColor: colors.primaryLight },
        fill: { height: 5 },
        details: { gap: spacing.sm + 2 },
        sectionLabel: { marginTop: 0, marginBottom: 0 },
    });
}
