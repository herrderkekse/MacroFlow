import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { removeSetVideo } from "../services/setVideoFiles";

/** What can be done with a stored set video besides looking at it: share it, remove it. */
export function useVideoActions(setUuid: string, uri: string) {
    const { t } = useTranslation();
    const router = useRouter();

    const share = useCallback(async () => {
        if (!(await Sharing.isAvailableAsync())) return;
        await Sharing.shareAsync(uri, { mimeType: uri.endsWith(".mov") ? "video/quicktime" : "video/mp4" });
    }, [uri]);

    const confirmRemove = useCallback(() => {
        Alert.alert(t("exercise.setVideo.removeTitle"), t("exercise.setVideo.removeConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("exercise.setVideo.remove"),
                style: "destructive",
                onPress: () => {
                    removeSetVideo(setUuid);
                    router.back();
                },
            },
        ]);
    }, [setUuid, router, t]);

    return { share, confirmRemove };
}
