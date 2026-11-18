import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { VideoPlayback } from "../hooks/useVideoPlayback";

const SIDE_WIDTH = 56;

interface PlaybackControlsProps {
    playback: VideoPlayback;
}

/**
 * Play and pause between a step to the previous and to the next frame, for
 * finding the exact moment (the bottom of a squat); speed and sound at the sides.
 */
export default function PlaybackControls({ playback }: PlaybackControlsProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { isPlaying, muted, rate, durationMs } = playback;
    const ready = durationMs > 0;
    const rateLabel = `${rate}×`;

    return (
        <View style={styles.row}>
            <View style={styles.side}>
                <Pressable
                    onPress={playback.cycleRate}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t("exercise.setVideo.speed", { rate: rateLabel })}
                    style={({ pressed }) => [styles.rate, rate !== 1 && styles.rateActive, pressed && styles.pressed]}
                >
                    <Text style={[styles.rateText, rate !== 1 && styles.rateTextActive]}>{rateLabel}</Text>
                </Pressable>
            </View>
            <View style={styles.transport}>
                <IconButton icon="chevron-back" variant="outline" label={t("exercise.setVideo.previousFrame")} onPress={() => playback.stepFrame(-1)} disabled={!ready} />
                <IconButton
                    icon={isPlaying ? "pause" : "play"}
                    variant="filled"
                    label={t(isPlaying ? "exercise.setVideo.pause" : "exercise.setVideo.play")}
                    onPress={playback.togglePlaying}
                    style={styles.play}
                />
                <IconButton icon="chevron-forward" variant="outline" label={t("exercise.setVideo.nextFrame")} onPress={() => playback.stepFrame(1)} disabled={!ready} />
            </View>
            <View style={[styles.side, styles.sideEnd]}>
                <IconButton
                    icon={muted ? "volume-mute-outline" : "volume-high-outline"}
                    label={t(muted ? "exercise.setVideo.soundOn" : "exercise.setVideo.soundOff")}
                    onPress={playback.toggleMuted}
                    color={muted ? colors.textSecondary : colors.text}
                />
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center" },
        // Equal sides keep the transport buttons centred under the video.
        side: { width: SIDE_WIDTH, alignItems: "flex-start" },
        sideEnd: { alignItems: "flex-end" },
        transport: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
        play: { width: 52, height: 52 },
        rate: {
            minWidth: 48,
            height: 32,
            paddingHorizontal: spacing.sm,
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            alignItems: "center",
            justifyContent: "center",
        },
        rateActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        rateText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600", fontVariant: ["tabular-nums"] },
        rateTextActive: { color: colors.onPrimary },
        pressed: { opacity: 0.6 },
    });
}
