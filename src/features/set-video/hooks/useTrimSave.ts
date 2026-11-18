import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler } from "react-native";
import { discardCapturedVideo, saveSetVideo } from "../services/setVideoFiles";
import type { useTrimRange } from "./useTrimRange";
import type { VideoPlayback } from "./useVideoPlayback";

interface TrimSaveInput {
    setUuid: string;
    uri: string;
    isNew: boolean;
    trim: ReturnType<typeof useTrimRange>;
    playback: VideoPlayback;
    /** A tracked path belongs to the file it was tracked in, and doesn't survive a trim. */
    hasBarPath: boolean;
    onTrimmed: () => void;
}

/**
 * Saving the trimmed video, and leaving the screen: a new video is attached
 * on saving and discarded (after asking) on leaving; a stored one is replaced
 * by its trimmed version.
 */
export function useTrimSave({ setUuid, uri, isNew, trim, playback, hasBarPath, onTrimmed }: TrimSaveInput) {
    const { t } = useTranslation();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);

    const back = useCallback(() => {
        if (!isNew) { router.back(); return; }
        Alert.alert(t("exercise.setVideo.discardTitle"), t("exercise.setVideo.discardConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("exercise.setVideo.discard"),
                style: "destructive",
                onPress: () => { discardCapturedVideo(uri); router.back(); },
            },
        ]);
    }, [isNew, router, uri, t]);

    useFocusEffect(useCallback(() => {
        if (!isNew) return;
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            back();
            return true;
        });
        return () => subscription.remove();
    }, [isNew, back]));

    const store = useCallback(async () => {
        setSaving(true);
        setFailed(false);
        playback.pause();
        try {
            await saveSetVideo({
                setUuid, sourceUri: uri, startMs: trim.startMs, endMs: trim.endMs, sourceDurationMs: playback.durationMs,
            });
        } catch {
            setFailed(true);
            setSaving(false);
            return;
        }
        if (isNew) router.back();
        else onTrimmed();
    }, [setUuid, uri, trim.startMs, trim.endMs, playback, isNew, router, onTrimmed]);

    const save = useCallback(async () => {
        if (!hasBarPath) { await store(); return; }
        Alert.alert(t("exercise.setVideo.trimTitle"), t("exercise.setVideo.trimDropsPath"), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.save"), onPress: () => void store() },
        ]);
    }, [hasBarPath, store, t]);

    return { back, save, saving, failed };
}
