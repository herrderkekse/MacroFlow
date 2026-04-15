import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface RestTimerProps {
    elapsedSeconds: number;
    targetSeconds: number;
    isTargetReached: boolean;
    onSkip: () => void;
}

export default function RestTimer({ elapsedSeconds, targetSeconds, isTargetReached, onSkip }: RestTimerProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const progress = Math.min(elapsedSeconds / targetSeconds, 1);
    const accentColor = isTargetReached ? "#f59e0b" : colors.primary;

    return (
        <View style={styles.container}>
            <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
            </View>
            <View style={styles.row}>
                <Ionicons name="timer-outline" size={16} color={accentColor} />
                <Text style={[styles.timeText, { color: accentColor }]}>
                    {t("exercise.restTimer.label")}: {formatTime(elapsedSeconds)} / {formatTime(targetSeconds)}
                </Text>
                <Pressable onPress={onSkip} style={styles.skipBtn} hitSlop={8}>
                    <Text style={[styles.skipText, { color: colors.primary }]}>{t("exercise.restTimer.skip")}</Text>
                </Pressable>
            </View>
        </View>
    );
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            marginVertical: spacing.xs,
        },
        progressBg: {
            height: 3,
            backgroundColor: colors.border,
            borderRadius: borderRadius.sm,
            overflow: "hidden",
            marginBottom: spacing.xs,
        },
        progressFill: {
            height: "100%",
            borderRadius: borderRadius.sm,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
        },
        timeText: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            flex: 1,
        },
        skipBtn: {
            paddingVertical: 2,
            paddingHorizontal: spacing.sm,
        },
        skipText: {
            fontSize: fontSize.xs,
            fontWeight: "600",
        },
    });
}
