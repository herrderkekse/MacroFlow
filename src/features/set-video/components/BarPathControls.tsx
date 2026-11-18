import IconButton from "@/src/shared/atoms/IconButton";
import Notice from "@/src/shared/atoms/Notice";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { useBarPathSession } from "../hooks/useBarPathSession";
import type { VideoPlayback } from "../hooks/useVideoPlayback";
import type { RepAnalysis } from "../types";
import PlateSizeControl from "./PlateSizeControl";
import WatchControls from "./WatchControls";

interface BarPathControlsProps {
    session: ReturnType<typeof useBarPathSession>;
    analysis: RepAnalysis | null;
    playback: VideoPlayback;
}

/**
 * Under the video in the bar path mode: how to mark the plate until it is
 * tracked, then the timeline with the reps marked on it.
 */
export default function BarPathControls({ session, analysis, playback }: BarPathControlsProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { phase, marker } = session;

    if (phase === "result" && analysis) {
        const marks = analysis.reps.map((rep) => ({ startMs: rep.startMs, endMs: rep.liftEndMs }));
        return <WatchControls playback={playback} marks={marks} />;
    }
    if (phase === "missing" || phase === "unavailable" || phase === "failed") {
        return <Notice tone={phase === "failed" ? "danger" : "info"}>{t(`barPath.${phase}`)}</Notice>;
    }
    // Reading and tracking keep the marking controls, so the video doesn't jump between them.
    const placing = phase === "place";
    return (
        <>
            <View style={styles.hintRow}>
                <Text style={styles.hint}>{t(marker ? "barPath.placedHint" : "barPath.placeHint")}</Text>
                <IconButton icon="remove" variant="outline" size="sm" label={t("barPath.smaller")} onPress={() => session.resize(false)} disabled={!placing || !marker} />
                <IconButton icon="add" variant="outline" size="sm" label={t("barPath.larger")} onPress={() => session.resize(true)} disabled={!placing || !marker} />
            </View>
            <PlateSizeControl diameterM={session.plateDiameterM} onChange={session.changePlateDiameter} />
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        hintRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        hint: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm },
    });
}
