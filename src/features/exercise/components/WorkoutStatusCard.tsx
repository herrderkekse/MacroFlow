import Button, { buttonContentColor } from "@/src/shared/atoms/Button";
import Chip from "@/src/shared/atoms/Chip";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import ChipRow from "@/src/shared/components/ChipRow";
import PinnedCard from "@/src/shared/components/PinnedCard";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

const PRESETS = [30, 60, 90, 120, 180, 300];
const FINE_STEP = 15;

interface WorkoutStatusCardProps {
    /** False for a finished workout: the card only reports the sets then. */
    isLive: boolean;
    resting: boolean;
    elapsedSeconds: number;
    /** The running rest's target, or the one a rest started now would get. */
    targetSeconds: number;
    setsDone: number;
    setsTotal: number;
    onStartRest: () => void;
    onSkipRest: () => void;
    onChangeDuration: (seconds: number) => void;
}

export function formatClock(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatPreset(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    return seconds % 60 === 0 ? `${seconds / 60}m` : formatClock(seconds);
}

/**
 * The workout's pinned card: while resting it counts the rest down, otherwise
 * it counts the sets done. Tapping it opens the rest settings underneath.
 * Built on `PinnedCard`, like the recipe editor's macro card.
 */
export default function WorkoutStatusCard({
    isLive, resting, elapsedSeconds, targetSeconds, setsDone, setsTotal,
    onStartRest, onSkipRest, onChangeDuration,
}: WorkoutStatusCardProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const over = resting && elapsedSeconds >= targetSeconds;
    const value = !resting
        ? `${setsDone} / ${setsTotal}`
        : over ? `+${formatClock(elapsedSeconds - targetSeconds)}` : formatClock(targetSeconds - elapsedSeconds);
    const unit = !resting
        ? t("exercise.restTimer.setsDone")
        : t(over ? "exercise.restTimer.over" : "exercise.restTimer.left", { target: formatClock(targetSeconds) });
    const fill = !resting
        ? (setsTotal > 0 ? setsDone / setsTotal : 0)
        : over ? 1 : Math.max(0, 1 - elapsedSeconds / targetSeconds);

    const summary = (
        <View style={styles.summary}>
            <Ionicons
                name={resting ? "timer-outline" : "checkmark-circle-outline"}
                size={18}
                color={over ? colors.warning : colors.text}
            />
            <View style={styles.reading}>
                <Text style={[styles.value, over && { color: colors.warning }]}>{value}</Text>
                <Text style={styles.unit} numberOfLines={1}>{unit}</Text>
            </View>
            {isLive && !resting && (
                <Pressable
                    onPress={onStartRest}
                    hitSlop={6}
                    style={({ pressed }) => [styles.startRest, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t("exercise.restTimer.start")}
                >
                    <Ionicons name="play" size={11} color={colors.text} />
                    <Text style={styles.startRestText}>{formatClock(targetSeconds)}</Text>
                </Pressable>
            )}
        </View>
    );

    const track = (
        <View style={styles.track}>
            <View
                style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: over ? colors.warning : colors.primary }]}
            />
        </View>
    );

    const details = (
        <View style={styles.details}>
            <SectionLabel style={styles.label}>{t("exercise.restTimer.duration")}</SectionLabel>
            {/* Chips, not segments: after a ±15 s step no preset is selected. */}
            <ChipRow scroll bleed={spacing.md}>
                {PRESETS.map((p) => (
                    <Chip
                        key={p}
                        label={formatPreset(p)}
                        selected={targetSeconds === p}
                        onPress={() => onChangeDuration(p)}
                    />
                ))}
            </ChipRow>
            <View style={styles.fineRow}>
                <Button
                    title={t("exercise.restTimer.seconds", { count: FINE_STEP })}
                    variant="outline"
                    size="sm"
                    icon={<Ionicons name="remove" size={14} color={buttonContentColor(colors, "outline")} />}
                    onPress={() => onChangeDuration(targetSeconds - FINE_STEP)}
                />
                <Text style={styles.target}>{formatClock(targetSeconds)}</Text>
                <Button
                    title={t("exercise.restTimer.seconds", { count: FINE_STEP })}
                    variant="outline"
                    size="sm"
                    icon={<Ionicons name="add" size={14} color={buttonContentColor(colors, "outline")} />}
                    onPress={() => onChangeDuration(targetSeconds + FINE_STEP)}
                />
            </View>
            {resting && (
                <Button
                    title={t("exercise.restTimer.skipRest")}
                    icon={<Ionicons name="play-skip-forward" size={14} color={colors.onPrimary} />}
                    onPress={onSkipRest}
                />
            )}
        </View>
    );

    return (
        <PinnedCard
            summary={summary}
            summaryFooter={track}
            // A finished workout has no rest left to set.
            details={isLive ? details : undefined}
            detailsLabel={t("exercise.restTimer.duration")}
        />
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        summary: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
        reading: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: spacing.xs + 2 },
        value: { fontSize: fontSize.xl - 1, fontWeight: "600", letterSpacing: -0.5, color: colors.text, fontVariant: ["tabular-nums"] },
        unit: { flexShrink: 1, fontSize: fontSize.xs, color: colors.textTertiary },
        startRest: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs + 1,
            height: 30,
            paddingHorizontal: spacing.sm + 3,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceMuted,
        },
        startRestText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text },
        pressed: { opacity: 0.6 },
        track: { height: 5, backgroundColor: colors.primaryLight },
        fill: { height: 5 },
        details: { gap: spacing.sm + 2 },
        label: { marginTop: 0, marginBottom: 0 },
        fineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        target: { flex: 1, textAlign: "center", fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
    });
}
