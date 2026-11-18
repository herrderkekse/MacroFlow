import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, type VideoPlayer } from "expo-video";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fitVideoStage } from "../helpers/videoStage";

interface VideoStageProps {
    player: VideoPlayer;
    /** Width over height of the video as shown; null while not known yet. */
    aspect: number | null;
    /**
     * False while the shape is still being found out: the video stays hidden
     * meanwhile, so it doesn't show in a box of the wrong shape and then jump.
     */
    shapeKnown: boolean;
    /** Drawn over the video, inside its box (a path, a marker). */
    overlay?: React.ReactNode;
    /** Along the stage's bottom edge, over the bottom of a tall video. */
    controls?: React.ReactNode;
    /** A tap on the video; none while the overlay takes taps itself. */
    onPress?: () => void;
    pressLabel?: string;
    /** Shows the play badge in the middle of the video. */
    paused?: boolean;
    /** Room kept free below the controls (the system bar, a sheet's peek). */
    bottomInset?: number;
}

/**
 * The video as large as its shape allows between the header and whatever is
 * below, with the controls over its bottom edge when it reaches under them.
 * One stage for every mode, so the picture stays put while they switch.
 */
export default function VideoStage({ player, aspect, shapeKnown, overlay, controls, onPress, pressLabel, paused, bottomInset = 0 }: VideoStageProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [stage, setStage] = useState({ width: 0, height: 0 });
    const [controlsHeight, setControlsHeight] = useState(0);
    const box = fitVideoStage({
        stageWidth: stage.width,
        stageHeight: stage.height,
        controlsHeight: controls ? controlsHeight : 0,
        sideInset: screenPadding,
        aspect,
    });

    return (
        <View style={[styles.stage, { marginBottom: bottomInset }]} onLayout={(e) => setStage(e.nativeEvent.layout)}>
            {/* Not animated when the controls change size: a layout animation blanks the video's surface on Android. */}
            {shapeKnown && (
                <View style={[styles.videoBox, { top: box.top, height: box.height }]}>
                    <Pressable
                        style={styles.press}
                        onPress={onPress}
                        disabled={!onPress}
                        accessibilityRole={onPress ? "button" : undefined}
                        accessibilityLabel={onPress ? pressLabel : undefined}
                    >
                        <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls={false} />
                        {overlay}
                        {paused && (
                            <View style={styles.playBadge} pointerEvents="none">
                                <Ionicons name="play" size={28} color={colors.onPrimary} />
                            </View>
                        )}
                    </Pressable>
                </View>
            )}

            {controls && (
                // Empty parts let taps through to the video.
                <View style={styles.controls} pointerEvents="box-none" onLayout={(e) => setControlsHeight(e.nativeEvent.layout.height)}>
                    {box.underControls && (
                        <LinearGradient
                            colors={["transparent", colors.background]}
                            locations={[0, 0.45]}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                        />
                    )}
                    {controls}
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        stage: { flex: 1 },
        videoBox: {
            position: "absolute",
            left: screenPadding,
            right: screenPadding,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
            backgroundColor: colors.surfaceMuted,
        },
        press: { flex: 1, alignItems: "center", justifyContent: "center" },
        fill: { ...StyleSheet.absoluteFill },
        playBadge: {
            width: 56,
            height: 56,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },
        controls: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: screenPadding,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
        },
    });
}
