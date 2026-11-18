import Button from "@/src/shared/atoms/Button";
import Notice from "@/src/shared/atoms/Notice";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { VideoView } from "expo-video";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import VideoTrimBar from "../components/VideoTrimBar";
import { formatClipTime, isWholeVideo } from "../helpers/trimRange";
import { fitVideoStage } from "../helpers/videoStage";
import { useTrimPlayer } from "../hooks/useTrimPlayer";
import { discardCapturedVideo, isVideoTrimAvailable, saveSetVideo } from "../services/setVideoFiles";

type Params = { setUuid: string; label: string; source: string; mode: "new" | "edit" };

/**
 * Cuts a set's video to the part worth keeping. Opened right after recording
 * or picking one ("new": leaving discards it), and from the set's video menu
 * ("edit": trims the stored video further).
 */
export default function SetVideoTrimScreen() {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const router = useRouter();
    const { setUuid, label, source, mode } = useLocalSearchParams<Params>();
    const trim = useTrimPlayer(source);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const canTrim = isVideoTrimAvailable();
    const isWhole = isWholeVideo(trim.startMs, trim.endMs, trim.durationMs);
    const [stage, setStage] = useState({ width: 0, height: 0 });
    const [controlsHeight, setControlsHeight] = useState(0);
    // The filmstrip's frames are upright, so their shape is the video's as shown.
    const firstThumb = trim.thumbnails[0];
    const box = fitVideoStage({
        stageWidth: stage.width,
        stageHeight: stage.height,
        controlsHeight,
        sideInset: screenPadding,
        aspect: firstThumb && firstThumb.height > 0 ? firstThumb.width / firstThumb.height : null,
    });

    const handleBack = useCallback(() => {
        if (mode !== "new") { router.back(); return; }
        Alert.alert(t("exercise.setVideo.discardTitle"), t("exercise.setVideo.discardConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("exercise.setVideo.discard"),
                style: "destructive",
                onPress: () => { discardCapturedVideo(source); router.back(); },
            },
        ]);
    }, [mode, router, source, t]);

    useFocusEffect(useCallback(() => {
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            handleBack();
            return true;
        });
        return () => subscription.remove();
    }, [handleBack]));

    async function handleSave() {
        setSaving(true);
        setFailed(false);
        trim.player.pause();
        try {
            await saveSetVideo({
                setUuid, sourceUri: source, startMs: trim.startMs, endMs: trim.endMs, sourceDurationMs: trim.durationMs,
            });
            router.back();
        } catch {
            setFailed(true);
            setSaving(false);
        }
    }

    return (
        <View style={styles.screen}>
            {/* A swipe back would skip the discard question. */}
            <Stack.Screen options={{ gestureEnabled: mode !== "new" }} />
            <ScreenHeader
                title={t(mode === "new" ? "exercise.setVideo.newTitle" : "exercise.setVideo.trimTitle")}
                subtitle={t("exercise.setVideo.sheetTitle", { set: label })}
                onBack={handleBack}
            />

            <View style={styles.stage} onLayout={(e) => setStage(e.nativeEvent.layout)}>
                <Pressable
                    style={[styles.videoBox, { top: box.top, height: box.height }]}
                    onPress={trim.togglePlaying}
                    accessibilityRole="button"
                    accessibilityLabel={t(trim.isPlaying ? "exercise.setVideo.pause" : "exercise.setVideo.play")}
                >
                    <VideoView player={trim.player} style={styles.video} contentFit="contain" nativeControls={false} />
                    {!trim.isPlaying && (
                        <View style={styles.playBadge} pointerEvents="none">
                            <Ionicons name="play" size={28} color={colors.onPrimary} />
                        </View>
                    )}
                </Pressable>

                {/* Over the bottom of a tall video; empty parts let taps through to it. */}
                <View
                    style={styles.controls}
                    pointerEvents="box-none"
                    onLayout={(e) => setControlsHeight(e.nativeEvent.layout.height)}
                >
                    {box.underControls && (
                        <LinearGradient
                            colors={["transparent", colors.background]}
                            locations={[0, 0.45]}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                        />
                    )}
                    {canTrim ? (
                        <View style={styles.trimArea}>
                            <VideoTrimBar
                                durationMs={trim.durationMs}
                                startMs={trim.startMs}
                                endMs={trim.endMs}
                                positionMs={trim.positionMs}
                                thumbnails={trim.thumbnails}
                                onChange={trim.setTrim}
                                onScrubStart={trim.onScrubStart}
                                onScrub={trim.onScrub}
                                onScrubEnd={trim.onScrubEnd}
                                onSeek={trim.seekTo}
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
                </View>
            </View>

            <FooterBar>
                <Button
                    title={t("common.save")}
                    onPress={handleSave}
                    loading={saving}
                    disabled={saving || trim.durationMs <= 0 || (mode === "edit" && isWhole)}
                />
            </FooterBar>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        // The video and the controls over its bottom edge, between header and footer.
        stage: { flex: 1 },
        videoBox: {
            position: "absolute",
            left: screenPadding,
            right: screenPadding,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
        },
        video: { ...StyleSheet.absoluteFill },
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
        // Inset past the screen edge's back-swipe zone, so grabbing a handle doesn't leave the screen.
        trimArea: { paddingHorizontal: spacing.lg, gap: spacing.sm },
        readout: { flexDirection: "row", justifyContent: "space-between" },
        readoutText: { color: colors.text, fontSize: fontSize.sm, fontVariant: ["tabular-nums"] },
        readoutLength: { color: colors.textSecondary, fontSize: fontSize.sm, fontVariant: ["tabular-nums"] },
    });
}
