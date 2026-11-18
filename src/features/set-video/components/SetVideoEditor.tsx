import Button from "@/src/shared/atoms/Button";
import IconButton from "@/src/shared/atoms/IconButton";
import ActionSheet from "@/src/shared/components/ActionSheet";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SegmentedControl, { type SegmentOption } from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Stack } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { analyzeReps } from "../helpers/repAnalysis";
import { isWholeVideo } from "../helpers/trimRange";
import { useBarPathSession } from "../hooks/useBarPathSession";
import { useFirstFrame } from "../hooks/useFirstFrame";
import { useTrimRange } from "../hooks/useTrimRange";
import { useTrimSave } from "../hooks/useTrimSave";
import { useVideoActions } from "../hooks/useVideoActions";
import { useVideoPlayback } from "../hooks/useVideoPlayback";
import { isVideoTrimAvailable } from "../services/setVideoFiles";
import BarPathControls from "./BarPathControls";
import BarPathLayer from "./BarPathLayer";
import RepSheet, { REP_SHEET_PEEK } from "./RepSheet";
import TrimControls from "./TrimControls";
import VideoStage from "./VideoStage";
import WatchControls from "./WatchControls";

type Mode = "watch" | "trim" | "barPath";

interface SetVideoEditorProps {
    setUuid: string;
    /** Names the set ("Bench press · 3"). */
    label: string;
    uri: string;
    /**
     * True for a video just recorded or picked: it is only trimmed, saving
     * attaches it, and leaving discards it.
     */
    isNew: boolean;
    /** False where sets are only looked at (history): no trimming, no removing. */
    editable: boolean;
    /** The stored video was trimmed, and is now another file. */
    onTrimmed: () => void;
}

/**
 * A set's video on one page: watching it (scrub, step frame by frame),
 * trimming it, and tracking its bar path, switched between in the header.
 * They share one player, so the picture and position carry over.
 */
export default function SetVideoEditor({ setUuid, label, uri, isNew, editable, onTrimmed }: SetVideoEditorProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const playback = useVideoPlayback(uri);
    const canTrim = isVideoTrimAvailable();
    const [mode, setMode] = useState<Mode>(isNew ? "trim" : "watch");
    const trim = useTrimRange(playback, mode === "trim");
    const session = useBarPathSession(setUuid, !isNew && mode === "barPath");
    const { phase } = session;
    const marking = mode === "barPath" && phase !== "result";
    const firstFrame = useFirstFrame(playback.player, marking);
    const analysis = useMemo(() => (session.path ? analyzeReps(session.path) : null), [session.path]);
    const actions = useVideoActions(setUuid, uri);
    const [menuVisible, setMenuVisible] = useState(false);
    const save = useTrimSave({ setUuid, uri, isNew, trim, playback, hasBarPath: session.path != null, onTrimmed });
    const { pause, play, seekTo } = playback;

    // The plate is marked on the first frame.
    useEffect(() => {
        if (mode === "barPath" && (phase === "place" || phase === "reading")) {
            pause();
            seekTo(0);
        }
    }, [mode, phase, pause, seekTo]);

    // A path just tracked plays at once.
    const previousPhase = useRef(phase);
    useEffect(() => {
        if (previousPhase.current === "tracking" && phase === "result" && mode === "barPath") play();
        previousPhase.current = phase;
    }, [phase, mode, play]);

    const modes = useMemo(() => {
        if (isNew) return [];
        const options: SegmentOption<Mode>[] = [{ key: "watch", label: t("exercise.setVideo.watch"), icon: "play-circle-outline" }];
        if (editable && canTrim) options.push({ key: "trim", label: t("exercise.setVideo.trim"), icon: "cut-outline" });
        options.push({ key: "barPath", label: t("exercise.setVideo.barPath"), icon: "analytics-outline" });
        return options;
    }, [isNew, editable, canTrim, t]);

    const title = mode === "watch"
        ? t("exercise.setVideo.watchTitle")
        : mode === "trim"
            ? t(isNew ? "exercise.setVideo.newTitle" : "exercise.setVideo.trimTitle")
            : t("barPath.title");

    const showsResult = mode === "barPath" && phase === "result" && analysis != null;
    const hasFooter = mode === "trim" || (mode === "barPath" && (phase === "place" || phase === "reading" || phase === "tracking"));
    const bottomInset = hasFooter ? 0 : showsResult ? REP_SHEET_PEEK + insets.bottom : insets.bottom;

    const controls = mode === "watch"
        ? <WatchControls playback={playback} />
        : mode === "trim"
            ? <TrimControls trim={trim} durationMs={playback.durationMs} thumbnails={playback.thumbnails} canTrim={canTrim} failed={save.failed} />
            : <BarPathControls session={session} analysis={analysis} playback={playback} />;

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            {/* A swipe back would skip the discard question. */}
            <Stack.Screen options={{ gestureEnabled: !isNew }} />
            <ScreenHeader
                title={title}
                subtitle={t("exercise.setVideo.sheetTitle", { set: label })}
                onBack={save.back}
                right={isNew ? undefined : (
                    <>
                        {modes.length > 1 && (
                            <SegmentedControl options={modes} value={mode} onChange={setMode} size="sm" iconOnly />
                        )}
                        {editable ? (
                            <IconButton icon="ellipsis-horizontal" label={t("exercise.setVideo.more")} onPress={() => setMenuVisible(true)} />
                        ) : (
                            <IconButton icon="share-outline" label={t("common.share")} onPress={() => void actions.share()} />
                        )}
                    </>
                )}
            />

            <VideoStage
                player={playback.player}
                aspect={playback.aspect}
                overlay={mode === "barPath"
                    ? <BarPathLayer session={session} analysis={analysis} playback={playback} firstFrame={firstFrame} />
                    : undefined}
                controls={controls}
                onPress={marking ? undefined : playback.togglePlaying}
                pressLabel={t(playback.isPlaying ? "exercise.setVideo.pause" : "exercise.setVideo.play")}
                paused={!marking && !playback.isPlaying}
                bottomInset={bottomInset}
            />

            {mode === "trim" && (
                <FooterBar>
                    <Button
                        title={t("common.save")}
                        onPress={() => void save.save()}
                        loading={save.saving}
                        disabled={save.saving || playback.durationMs <= 0 || (!isNew && isWholeVideo(trim.startMs, trim.endMs, playback.durationMs))}
                    />
                </FooterBar>
            )}
            {hasFooter && mode === "barPath" && (
                <FooterBar horizontal={!!session.cancelPlacing}>
                    {session.cancelPlacing && (
                        <Button title={t("common.cancel")} variant="secondary" onPress={session.cancelPlacing} disabled={phase === "tracking"} style={styles.footerButton} />
                    )}
                    <Button
                        title={t("barPath.track")}
                        onPress={() => void session.track()}
                        loading={phase === "tracking"}
                        disabled={!session.marker || phase !== "place"}
                        style={styles.footerButton}
                    />
                </FooterBar>
            )}

            {showsResult && analysis && (
                <RepSheet
                    analysis={analysis}
                    plateDiameterM={session.plateDiameterM}
                    onPlateDiameterChange={session.changePlateDiameter}
                    onRepPress={(ms) => {
                        seekTo(ms);
                        play();
                    }}
                    onRedo={session.canRedo ? session.redo : null}
                />
            )}

            {editable && !isNew && (
                <ActionSheet
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    title={t("exercise.setVideo.sheetTitle", { set: label })}
                    actions={[
                        { key: "share", icon: "share-outline", label: t("common.share"), onPress: () => setTimeout(() => void actions.share(), AFTER_SHEET_MS) },
                        { key: "remove", icon: "trash-outline", label: t("exercise.setVideo.remove"), destructive: true, onPress: actions.confirmRemove },
                    ]}
                />
            )}
        </View>
    );
}

// The menu slides out before the share sheet covers the screen.
const AFTER_SHEET_MS = 250;

const styles = StyleSheet.create({
    screen: { flex: 1 },
    footerButton: { flex: 1 },
});
