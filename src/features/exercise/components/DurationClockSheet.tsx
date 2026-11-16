import Button from "@/src/shared/atoms/Button";
import Chip from "@/src/shared/atoms/Chip";
import ChipRow from "@/src/shared/components/ChipRow";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatDuration } from "../helpers/durationFormat";
import { TIMER_MAX_SECONDS, TIMER_MIN_SECONDS, type ClockMode, type DurationClock } from "../hooks/useDurationClock";
import RestDurationStepper from "./RestDurationStepper";

const PRESETS = [30, 60, 120, 300, 600, 1800];

interface DurationClockSheetProps {
    visible: boolean;
    onClose: () => void;
    /** The exercise's name. */
    title: string;
    clock: DurationClock;
}

function formatPreset(seconds: number): string {
    return seconds < 60 ? `${seconds}s` : `${seconds / 60}m`;
}

/**
 * A stopwatch or a timer for a duration exercise. While it runs, the
 * exercise's next set takes its duration from it.
 */
export default function DurationClockSheet({ visible, onClose, title, clock }: DurationClockSheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const isTimer = clock.mode === "timer";
    // Mode and countdown are set before the clock starts, and stay put until it is reset.
    const idle = !clock.isOwn;
    const reading = isTimer ? clock.timerSeconds - clock.elapsedSeconds : clock.elapsedSeconds;

    const status = clock.isDone
        ? t("exercise.durationClock.done")
        : clock.isRunning
            ? t(isTimer ? "exercise.durationClock.timerRunning" : "exercise.durationClock.stopwatchRunning")
            : clock.isOwn ? t("exercise.durationClock.paused") : t("exercise.durationClock.hint");

    const primary = clock.isRunning
        ? { title: t("exercise.durationClock.pause"), icon: "pause" as const, onPress: clock.pause }
        : {
            title: t(clock.isOwn && !clock.isDone ? "exercise.durationClock.resume" : "exercise.durationClock.start"),
            icon: "play" as const,
            onPress: clock.start,
        };

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button
                        title={primary.title}
                        icon={<Ionicons name={primary.icon} size={14} color={colors.onPrimary} />}
                        onPress={primary.onPress}
                    />
                    {clock.isOwn && (
                        <Button title={t("exercise.durationClock.reset")} variant="outline" onPress={clock.reset} />
                    )}
                </>
            }
        >
            <View style={styles.body}>
                {idle && (
                    <SegmentedControl<ClockMode>
                        options={[
                            { key: "stopwatch", label: t("exercise.durationClock.stopwatch"), icon: "stopwatch-outline" },
                            { key: "timer", label: t("exercise.durationClock.timer"), icon: "timer-outline" },
                        ]}
                        value={clock.mode}
                        onChange={clock.setMode}
                    />
                )}

                <View style={styles.readout}>
                    <Text style={[styles.reading, clock.isDone && { color: colors.success }]}>{formatDuration(reading)}</Text>
                    <Text style={styles.status}>{status}</Text>
                </View>

                {isTimer && idle && (
                    <View style={styles.timerSettings}>
                        {/* Chips, not segments: after a ±15 s step no preset is selected. */}
                        <ChipRow scroll bleed={spacing.md}>
                            {PRESETS.map((p) => (
                                <Chip
                                    key={p}
                                    label={formatPreset(p)}
                                    selected={clock.timerSeconds === p}
                                    onPress={() => clock.setTimerSeconds(p)}
                                />
                            ))}
                        </ChipRow>
                        <RestDurationStepper
                            seconds={clock.timerSeconds}
                            onChange={clock.setTimerSeconds}
                            min={TIMER_MIN_SECONDS}
                            max={TIMER_MAX_SECONDS}
                        />
                    </View>
                )}
            </View>
        </Sheet>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        body: { gap: spacing.md, marginBottom: spacing.md },
        readout: { alignItems: "center", paddingVertical: spacing.md, gap: spacing.xs },
        reading: {
            fontSize: 56,
            fontWeight: "600",
            letterSpacing: -1.5,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        status: { fontSize: fontSize.sm, color: colors.textTertiary, textAlign: "center" },
        timerSettings: { gap: spacing.sm + 2 },
    });
}
