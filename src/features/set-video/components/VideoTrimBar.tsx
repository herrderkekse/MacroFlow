import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, type ThemeColors } from "@/src/utils/theme";
import type { VideoThumbnail } from "expo-video";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { FILMSTRIP } from "../constants";
import { moveTrimEnd, moveTrimStart } from "../helpers/trimRange";
import Filmstrip from "./Filmstrip";

const HANDLE_WIDTH = FILMSTRIP.endInset;
const FRAME_BORDER = FILMSTRIP.border;
// What one accessibility increment/decrement moves a handle by.
const A11Y_STEP_MS = 500;

interface VideoTrimBarProps {
    durationMs: number;
    startMs: number;
    endMs: number;
    /** The playhead, drawn while the clip plays. */
    positionMs: number;
    thumbnails: VideoThumbnail[];
    onChange: (startMs: number, endMs: number) => void;
    /** A handle is picked up / moved to `ms` / let go; the screen shows that frame meanwhile. */
    onScrubStart: () => void;
    onScrub: (ms: number) => void;
    onScrubEnd: () => void;
    /** A tap inside the kept range: show the video from there. */
    onSeek: (ms: number) => void;
}

/** The video as a filmstrip, with a handle at each end of the kept range. */
export default function VideoTrimBar(props: VideoTrimBarProps) {
    const { durationMs, startMs, endMs, positionMs, thumbnails } = props;
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [width, setWidth] = useState(0);
    // The time axis runs between the handles' inner edges.
    const track = Math.max(1, width - HANDLE_WIDTH * 2);
    const toX = (ms: number) => (durationMs > 0 ? (ms / durationMs) * track : 0);

    // Where the dragged handle was picked up; null until the drag has begun.
    const [dragOrigin, setDragOrigin] = useState<number | null>(null);
    const { onChange, onScrubStart, onScrub, onScrubEnd, onSeek } = props;

    const [startGesture, endGesture] = useMemo(() => {
        const handleGesture = (which: "start" | "end") => Gesture.Pan()
            .runOnJS(true)
            .onBegin(() => {
                setDragOrigin(which === "start" ? startMs : endMs);
                onScrubStart();
            })
            .onUpdate((e) => {
                if (dragOrigin == null) return;
                const proposed = dragOrigin + (e.translationX / track) * durationMs;
                const next = which === "start" ? moveTrimStart(proposed, endMs) : moveTrimEnd(proposed, startMs, durationMs);
                if (which === "start") onChange(next, endMs);
                else onChange(startMs, next);
                onScrub(next);
            })
            .onFinalize(() => {
                setDragOrigin(null);
                onScrubEnd();
            });
        return [handleGesture("start"), handleGesture("end")];
    }, [startMs, endMs, durationMs, track, dragOrigin, onChange, onScrubStart, onScrub, onScrubEnd]);

    // A tap between the handles moves the playhead there; taps on the handles or the dimmed parts do nothing.
    const tapGesture = useMemo(() => Gesture.Tap()
        .runOnJS(true)
        .onEnd((e) => {
            if (durationMs <= 0) return;
            const ms = ((e.x - HANDLE_WIDTH) / track) * durationMs;
            if (ms >= startMs && ms <= endMs) onSeek(ms);
        }), [durationMs, track, startMs, endMs, onSeek]);

    function handleA11y(which: "start" | "end", event: AccessibilityActionEvent) {
        const step = event.nativeEvent.actionName === "increment" ? A11Y_STEP_MS : -A11Y_STEP_MS;
        if (which === "start") onChange(moveTrimStart(startMs + step, endMs), endMs);
        else onChange(startMs, moveTrimEnd(endMs + step, startMs, durationMs));
    }

    const startX = toX(startMs);
    const endX = toX(endMs);
    const a11yActions = [{ name: "increment" as const }, { name: "decrement" as const }];

    return (
        <GestureDetector gesture={tapGesture}>
            <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                <Filmstrip thumbnails={thumbnails} />

                <View style={[styles.dim, { left: HANDLE_WIDTH, width: startX }]} />
                <View style={[styles.dim, { left: HANDLE_WIDTH + endX, right: HANDLE_WIDTH }]} />
                {/* The bars of the frame run between the handles' inner edges, so they meet the handles' rounded ends flush. */}
                <View style={[styles.frame, { left: HANDLE_WIDTH + startX, width: endX - startX }]} pointerEvents="none" />

                {positionMs > startMs && positionMs < endMs && (
                    <View style={[styles.playhead, { left: HANDLE_WIDTH + toX(positionMs) - 1 }]} pointerEvents="none" />
                )}

                <GestureDetector gesture={startGesture}>
                    <View
                        style={[styles.handle, styles.handleStart, { left: startX }]}
                        hitSlop={{ left: 12, right: 8, top: 8, bottom: 8 }}
                        accessible
                        accessibilityRole="adjustable"
                        accessibilityLabel={t("exercise.setVideo.trimStart")}
                        accessibilityActions={a11yActions}
                        onAccessibilityAction={(e) => handleA11y("start", e)}
                    >
                        <View style={styles.grip} />
                    </View>
                </GestureDetector>
                <GestureDetector gesture={endGesture}>
                    <View
                        style={[styles.handle, styles.handleEnd, { left: HANDLE_WIDTH + endX }]}
                        hitSlop={{ left: 8, right: 12, top: 8, bottom: 8 }}
                        accessible
                        accessibilityRole="adjustable"
                        accessibilityLabel={t("exercise.setVideo.trimEnd")}
                        accessibilityActions={a11yActions}
                        onAccessibilityAction={(e) => handleA11y("end", e)}
                    >
                        <View style={styles.grip} />
                    </View>
                </GestureDetector>
            </View>
        </GestureDetector>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        bar: { height: FILMSTRIP.height, justifyContent: "center" },
        dim: { position: "absolute", top: FRAME_BORDER, bottom: FRAME_BORDER, backgroundColor: colors.overlay },
        frame: {
            position: "absolute",
            top: 0,
            bottom: 0,
            borderTopWidth: FRAME_BORDER,
            borderBottomWidth: FRAME_BORDER,
            borderColor: colors.primary,
        },
        playhead: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: colors.surface },
        handle: {
            position: "absolute",
            top: 0,
            bottom: 0,
            width: HANDLE_WIDTH,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },
        handleStart: { borderTopLeftRadius: borderRadius.md, borderBottomLeftRadius: borderRadius.md },
        handleEnd: { borderTopRightRadius: borderRadius.md, borderBottomRightRadius: borderRadius.md },
        grip: { width: 3, height: 18, borderRadius: borderRadius.full, backgroundColor: colors.onPrimary },
    });
}
