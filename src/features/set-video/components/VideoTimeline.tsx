import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { FILMSTRIP } from "../constants";
import { formatClipTime } from "../helpers/trimRange";
import { usePlayerPosition } from "../hooks/usePlayerPosition";
import type { VideoPlayback } from "../hooks/useVideoPlayback";
import Filmstrip from "./Filmstrip";

const INSET = FILMSTRIP.endInset;
// What one accessibility increment/decrement moves the playhead by.
const A11Y_STEP_MS = 1000;
const MARK_HEIGHT = 5;

export interface TimelineMark {
    startMs: number;
    endMs: number;
}

interface VideoTimelineProps {
    playback: VideoPlayback;
    /** Spans marked along the strip's bottom edge (the reps of a set). */
    marks?: TimelineMark[];
}

/**
 * The video as a filmstrip with its playhead: touching it anywhere shows that
 * frame, and dragging scrubs through the video. Under it, the time.
 */
export default function VideoTimeline({ playback, marks }: VideoTimelineProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { durationMs, thumbnails, scrubStart, scrubTo, scrubEnd, seekTo } = playback;
    const positionMs = Math.min(Math.max(usePlayerPosition(playback), 0), durationMs);
    const [width, setWidth] = useState(0);
    const track = Math.max(1, width - INSET * 2);
    const toX = (ms: number) => (durationMs > 0 ? (ms / durationMs) * track : 0);

    const gesture = useMemo(() => {
        const toMs = (x: number) => Math.min(Math.max(((x - INSET) / track) * durationMs, 0), durationMs);
        // Begins on touch down, so a tap is a scrub that doesn't move.
        return Gesture.Pan()
            .runOnJS(true)
            .onBegin((e) => {
                if (durationMs <= 0) return;
                scrubStart();
                scrubTo(toMs(e.x));
            })
            .onUpdate((e) => { if (durationMs > 0) scrubTo(toMs(e.x)); })
            .onFinalize(() => { if (durationMs > 0) scrubEnd(); });
    }, [track, durationMs, scrubStart, scrubTo, scrubEnd]);

    function handleA11y(event: AccessibilityActionEvent) {
        const step = event.nativeEvent.actionName === "increment" ? A11Y_STEP_MS : -A11Y_STEP_MS;
        seekTo(positionMs + step);
    }

    return (
        <View style={styles.container}>
            <GestureDetector gesture={gesture}>
                <View
                    style={styles.bar}
                    onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel={t("exercise.setVideo.timeline")}
                    accessibilityValue={{ text: formatClipTime(positionMs) }}
                    accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                    onAccessibilityAction={handleA11y}
                >
                    <Filmstrip thumbnails={thumbnails} rounded />
                    {marks?.map((mark) => (
                        <View
                            key={mark.startMs}
                            pointerEvents="none"
                            style={[styles.mark, { left: INSET + toX(mark.startMs), width: Math.max(2, toX(mark.endMs) - toX(mark.startMs)) }]}
                        />
                    ))}
                    {durationMs > 0 && (
                        <View style={[styles.playhead, { left: INSET + toX(positionMs) - PLAYHEAD_WIDTH / 2 }]} pointerEvents="none" />
                    )}
                </View>
            </GestureDetector>
            <View style={styles.readout}>
                <Text style={styles.readoutText}>{formatClipTime(positionMs)}</Text>
                <Text style={styles.readoutTotal}>{formatClipTime(durationMs)}</Text>
            </View>
        </View>
    );
}

const PLAYHEAD_WIDTH = 4;

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { gap: spacing.sm },
        bar: { height: FILMSTRIP.height, justifyContent: "center" },
        mark: {
            position: "absolute",
            bottom: FILMSTRIP.border + 3,
            height: MARK_HEIGHT,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary,
            borderWidth: 1,
            borderColor: colors.surface,
        },
        // Over the strip's whole height and a little past it, ink with a light edge to stand out on any frame.
        playhead: {
            position: "absolute",
            top: 0,
            bottom: 0,
            width: PLAYHEAD_WIDTH,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary,
            borderWidth: 1,
            borderColor: colors.surface,
        },
        // Lined up with the strip's ends.
        readout: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: INSET },
        readoutText: { color: colors.text, fontSize: fontSize.sm, fontVariant: ["tabular-nums"] },
        readoutTotal: { color: colors.textSecondary, fontSize: fontSize.sm, fontVariant: ["tabular-nums"] },
    });
}
