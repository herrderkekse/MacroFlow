import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface RestTimerProps {
    elapsedSeconds: number;
    targetSeconds: number;
    isTargetReached: boolean;
    onSkip: () => void;
    onChangeDuration: (seconds: number) => void;
}

const QUICK_PRESETS = [30, 60, 90, 120, 180, 300];

export default function RestTimer({
    elapsedSeconds,
    targetSeconds,
    isTargetReached,
    onSkip,
    onChangeDuration,
}: RestTimerProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isExpanded, setIsExpanded] = useState(false);

    const progress = Math.min(elapsedSeconds / targetSeconds, 1);
    const accentColor = isTargetReached ? colors.warning : colors.primary;

    return (
        <View style={styles.container}>
            {/* ── Header row ─────────────────────────────────── */}
            <Pressable style={styles.header} onPress={() => setIsExpanded((v) => !v)} hitSlop={6}>
                <Ionicons name="timer-outline" size={16} color={accentColor} />
                <Text style={[styles.headerText, { color: accentColor }]}>
                    {t("exercise.restTimer.label")} {formatTime(elapsedSeconds)} / {formatTime(targetSeconds)}
                </Text>
                <Pressable onPress={onSkip} style={styles.skipBtn} hitSlop={8}>
                    <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                        {t("exercise.restTimer.skip")}
                    </Text>
                </Pressable>
                <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.textSecondary}
                />
            </Pressable>

            {/* ── Progress bar ────────────────────────────────── */}
            <View style={styles.progressBg}>
                <View
                    style={[
                        styles.progressFill,
                        { width: `${progress * 100}%`, backgroundColor: accentColor },
                    ]}
                />
            </View>

            {/* ── Expanded body ───────────────────────────────── */}
            {isExpanded && (
                <View style={styles.body}>
                    <Text style={styles.sectionLabel}>{t("exercise.restTimer.adjustDuration")}</Text>

                    {/* Quick presets */}
                    <View style={styles.presetsRow}>
                        {QUICK_PRESETS.map((s) => (
                            <Pressable
                                key={s}
                                style={[
                                    styles.presetBtn,
                                    targetSeconds === s && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                                ]}
                                onPress={() => onChangeDuration(s)}
                            >
                                <Text
                                    style={[
                                        styles.presetText,
                                        targetSeconds === s && { color: colors.primary, fontWeight: "700" },
                                    ]}
                                >
                                    {formatPreset(s)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Fine-grained adjustment */}
                    <View style={styles.fineRow}>
                        <Pressable
                            style={styles.fineBtn}
                            onPress={() => onChangeDuration(targetSeconds - 15)}
                        >
                            <Ionicons name="remove" size={16} color={colors.text} />
                            <Text style={styles.fineBtnText}>15s</Text>
                        </Pressable>
                        <View style={styles.currentDuration}>
                            <Text style={[styles.currentDurationText, { color: accentColor }]}>
                                {formatTime(targetSeconds)}
                            </Text>
                        </View>
                        <Pressable
                            style={styles.fineBtn}
                            onPress={() => onChangeDuration(targetSeconds + 15)}
                        >
                            <Ionicons name="add" size={16} color={colors.text} />
                            <Text style={styles.fineBtnText}>15s</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPreset(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = seconds / 60;
    return Number.isInteger(m) ? `${m}m` : `${Math.floor(m)}:${String(seconds % 60).padStart(2, "0")}`;
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            marginVertical: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
        },
        headerText: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
        },
        skipBtn: {
            paddingVertical: 2,
            paddingHorizontal: spacing.xs,
        },
        skipText: {
            fontSize: fontSize.xs,
            fontWeight: "500",
        },
        progressBg: {
            height: 3,
            backgroundColor: colors.border,
            marginHorizontal: spacing.sm,
            marginBottom: spacing.xs,
            borderRadius: borderRadius.sm,
            overflow: "hidden",
        },
        progressFill: {
            height: "100%",
            borderRadius: borderRadius.sm,
        },
        body: {
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.sm,
            paddingTop: spacing.xs,
            gap: spacing.sm,
        },
        sectionLabel: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            fontWeight: "500",
        },
        presetsRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            gap: spacing.xs,
        },
        presetBtn: {
            flex: 1,
            alignItems: "center",
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        presetText: {
            fontSize: fontSize.xs,
            color: colors.text,
            fontWeight: "500",
        },
        fineRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        fineBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        fineBtnText: {
            fontSize: fontSize.xs,
            color: colors.text,
            fontWeight: "500",
        },
        currentDuration: {
            flex: 1,
            alignItems: "center",
        },
        currentDurationText: {
            fontSize: fontSize.lg,
            fontWeight: "700",
        },
    });
}

