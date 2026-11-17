import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { VideoView } from "expo-video";
import Button from "@/src/shared/atoms/Button";
import IconButton from "@/src/shared/atoms/IconButton";
import Notice from "@/src/shared/atoms/Notice";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import BarPathOverlay from "../components/BarPathOverlay";
import MarkerPlacer from "../components/MarkerPlacer";
import PlateSizeControl from "../components/PlateSizeControl";
import RepList from "../components/RepList";
import { analyzeReps } from "../helpers/repAnalysis";
import { useBarPathSession } from "../hooks/useBarPathSession";
import { usePathPlayer } from "../hooks/usePathPlayer";

type Params = { setUuid: string; label: string };

/**
 * Tracks the bar in a set's video and shows its path over the video, with the
 * reps measured from it. The plate at the near end of the bar is marked once
 * on the first frame; from then on it is followed automatically.
 */
export default function BarPathScreen() {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { setUuid, label } = useLocalSearchParams<Params>();
    const session = useBarPathSession(setUuid);
    const { phase, path, firstFrame, marker } = session;
    const video = usePathPlayer(session.videoUri, phase !== "result");
    const analysis = path ? analyzeReps(path) : null;
    const { showFirstFrame, player } = video;

    // Marking happens on the first frame; the result plays.
    useEffect(() => {
        if (phase === "place" || phase === "reading") showFirstFrame();
        else if (phase === "result") player.play();
    }, [phase, showFirstFrame, player]);

    const busy = phase === "reading" || phase === "tracking";

    return (
        <View style={styles.screen}>
            <ScreenHeader
                title={t("barPath.title")}
                subtitle={t("barPath.subtitle", { set: label })}
                right={phase === "result" && session.canRedo ? (
                    <IconButton icon="locate-outline" label={t("barPath.redo")} onPress={session.redo} />
                ) : undefined}
            />

            {session.videoUri && (
                <Pressable
                    style={styles.videoBox}
                    onPress={phase === "result" ? video.togglePlaying : undefined}
                    disabled={phase !== "result"}
                    accessibilityRole={phase === "result" ? "button" : undefined}
                    accessibilityLabel={phase === "result" ? t(video.isPlaying ? "barPath.pause" : "barPath.play") : undefined}
                >
                    <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
                    {phase !== "result" && video.firstFrame && (
                        <Image source={video.firstFrame} style={styles.video} contentFit="contain" />
                    )}
                    {phase === "place" && firstFrame && (
                        <MarkerPlacer frameWidth={firstFrame.width} frameHeight={firstFrame.height} marker={marker} onPlace={session.place} />
                    )}
                    {phase === "result" && path && analysis && (
                        <BarPathOverlay
                            frameWidth={path.frameWidth}
                            frameHeight={path.frameHeight}
                            t={path.t}
                            x={analysis.x}
                            y={analysis.y}
                            reps={analysis.reps}
                            player={player}
                            isPlaying={video.isPlaying}
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
                    {phase === "result" && !video.isPlaying && (
                        <View style={styles.playBadge} pointerEvents="none">
                            <Ionicons name="play" size={28} color={colors.onPrimary} />
                        </View>
                    )}
                </Pressable>
            )}

            {phase === "place" && (
                <View style={styles.controls}>
                    <View style={styles.hintRow}>
                        <Text style={styles.hint}>{t(marker ? "barPath.placedHint" : "barPath.placeHint")}</Text>
                        <IconButton icon="remove" variant="outline" size="sm" label={t("barPath.smaller")} onPress={() => session.resize(false)} disabled={!marker} />
                        <IconButton icon="add" variant="outline" size="sm" label={t("barPath.larger")} onPress={() => session.resize(true)} disabled={!marker} />
                    </View>
                    <PlateSizeControl diameterM={session.plateDiameterM} onChange={session.changePlateDiameter} />
                </View>
            )}

            {phase === "result" && analysis && (
                <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
                    <RepList analysis={analysis} onRepPress={video.playFrom} />
                    <PlateSizeControl diameterM={session.plateDiameterM} onChange={session.changePlateDiameter} />
                </ScrollView>
            )}

            {(phase === "missing" || phase === "unavailable" || phase === "failed") && (
                <View style={styles.controls}>
                    <Notice tone={phase === "failed" ? "danger" : "info"}>{t(`barPath.${phase}`)}</Notice>
                </View>
            )}

            {(phase === "place" || phase === "tracking") && (
                <FooterBar horizontal={!!session.cancelPlacing}>
                    {session.cancelPlacing && (
                        <Button title={t("common.cancel")} variant="secondary" onPress={session.cancelPlacing} disabled={phase === "tracking"} style={styles.footerButton} />
                    )}
                    <Button
                        title={t("barPath.track")}
                        onPress={() => void session.track()}
                        loading={phase === "tracking"}
                        disabled={!marker || phase === "tracking"}
                        style={styles.footerButton}
                    />
                </FooterBar>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        videoBox: {
            flex: 1,
            minHeight: 220,
            marginHorizontal: screenPadding,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
        },
        video: { ...StyleSheet.absoluteFill },
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
        playBadge: {
            width: 56,
            height: 56,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },
        controls: { paddingHorizontal: screenPadding, paddingTop: spacing.md, gap: spacing.sm },
        hintRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        hint: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm },
        results: { flexGrow: 0, maxHeight: "48%" },
        resultsContent: { paddingHorizontal: screenPadding, paddingVertical: spacing.md, gap: spacing.md },
        footerButton: { flex: 1 },
    });
}
