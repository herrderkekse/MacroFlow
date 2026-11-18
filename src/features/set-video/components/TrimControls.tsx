import Notice from "@/src/shared/atoms/Notice";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import type { VideoThumbnail } from "expo-video";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatClipTime } from "../helpers/trimRange";
import type { useTrimRange } from "../hooks/useTrimRange";
import VideoTrimBar from "./VideoTrimBar";

interface TrimControlsProps {
    trim: ReturnType<typeof useTrimRange>;
    durationMs: number;
    thumbnails: VideoThumbnail[];
    /** False on builds that can't cut videos: the whole video is kept. */
    canTrim: boolean;
    failed: boolean;
}

/** The filmstrip with a handle at each end of the kept range, and the range in numbers. */
export default function TrimControls({ trim, durationMs, thumbnails, canTrim, failed }: TrimControlsProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();

    return (
        <>
            {canTrim ? (
                <View style={styles.area}>
                    <VideoTrimBar
                        durationMs={durationMs}
                        startMs={trim.startMs}
                        endMs={trim.endMs}
                        positionMs={trim.positionMs}
                        thumbnails={thumbnails}
                        onChange={trim.setTrim}
                        onScrubStart={trim.onScrubStart}
                        onScrub={trim.onScrub}
                        onScrubEnd={trim.onScrubEnd}
                        onSeek={trim.seekInside}
                    />
                    <View style={styles.readout}>
                        <Text style={styles.readoutText}>
                            {formatClipTime(trim.startMs)} – {formatClipTime(trim.endMs)}
                        </Text>
                        <Text style={styles.readoutLength}>
                            {t("exercise.setVideo.length", { length: formatClipTime(trim.endMs - trim.startMs) })}
                        </Text>
                    </View>
                </View>
            ) : (
                <Notice>{t("exercise.setVideo.trimUnavailable")}</Notice>
            )}
            {failed && <Notice tone="danger">{t("exercise.setVideo.saveFailed")}</Notice>}
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        // Inset past the screen edge's back-swipe zone, so grabbing a handle doesn't leave the screen.
        area: { paddingHorizontal: spacing.lg, gap: spacing.sm },
        readout: { flexDirection: "row", justifyContent: "space-between" },
        readoutText: { color: colors.text, fontSize: fontSize.sm, fontVariant: ["tabular-nums"] },
        readoutLength: { color: colors.textSecondary, fontSize: fontSize.sm, fontVariant: ["tabular-nums"] },
    });
}
