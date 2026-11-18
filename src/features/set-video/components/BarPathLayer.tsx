import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Image } from "expo-image";
import type { VideoThumbnail } from "expo-video";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { useBarPathSession } from "../hooks/useBarPathSession";
import type { VideoPlayback } from "../hooks/useVideoPlayback";
import type { RepAnalysis } from "../types";
import BarPathOverlay from "./BarPathOverlay";
import MarkerPlacer from "./MarkerPlacer";

interface BarPathLayerProps {
    session: ReturnType<typeof useBarPathSession>;
    analysis: RepAnalysis | null;
    playback: VideoPlayback;
    /** The first frame as a picture, shown while the plate is marked on it. */
    firstFrame: VideoThumbnail | null;
}

/** What the bar path mode draws over the video: the marker while placing it, the path once tracked. */
export default function BarPathLayer({ session, analysis, playback, firstFrame }: BarPathLayerProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { phase, path, marker } = session;
    const busy = phase === "reading" || phase === "tracking";

    return (
        <>
            {phase !== "result" && firstFrame && (
                <Image source={firstFrame} style={StyleSheet.absoluteFill} contentFit="contain" />
            )}
            {phase === "place" && session.firstFrame && (
                <MarkerPlacer
                    frameWidth={session.firstFrame.width}
                    frameHeight={session.firstFrame.height}
                    marker={marker}
                    onPlace={session.place}
                />
            )}
            {phase === "result" && path && analysis && (
                <BarPathOverlay
                    frameWidth={path.frameWidth}
                    frameHeight={path.frameHeight}
                    t={path.t}
                    x={analysis.x}
                    y={analysis.y}
                    reps={analysis.reps}
                    playback={playback}
                    plateRadius={path.marker.r}
                />
            )}
            {busy && (
                <View style={styles.busy} pointerEvents="none">
                    <ActivityIndicator color={colors.onPrimary} />
                    <Text style={styles.busyText}>
                        {phase === "reading"
                            ? t("barPath.reading")
                            : t("barPath.tracking", { percent: Math.round(session.progress * 100) })}
                    </Text>
                </View>
            )}
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        busy: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary,
        },
        busyText: { color: colors.onPrimary, fontSize: fontSize.sm, fontVariant: ["tabular-nums"] },
    });
}
