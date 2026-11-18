import ActionSheet, { type ActionSheetItem } from "@/src/shared/components/ActionSheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { SetVideoContext, type SetVideoContextValue } from "../hooks/useSetVideo";
import { listSetVideos, type SetVideo } from "@/src/features/set-video/services/setVideoDb";
import { isVideoTrimAvailable, removeSetVideo, setVideoUri } from "@/src/features/set-video/services/setVideoFiles";
import SetVideoPlayer from "./SetVideoPlayer";

// Long enough for any set; keeps an accidentally running camera from filling the phone.
const MAX_RECORDING_SECONDS = 10 * 60;
// The sheet slides out before the camera or picker covers the screen; iOS
// won't present one over a modal that is still being dismissed.
const AFTER_SHEET_MS = 250;

interface SetVideoProviderProps {
    /** False where sets are only looked at (history): play and share, nothing else. */
    editable?: boolean;
    children: React.ReactNode;
}

/**
 * Gives the set rows inside it their videos (`useSetVideo`) and owns the one
 * menu and player they open. Reloads whenever its screen comes back into
 * focus, e.g. from the trim screen.
 */
export default function SetVideoProvider({ editable = true, children }: SetVideoProviderProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const [videos, setVideos] = useState<Map<string, SetVideo>>(() => new Map());
    // Kept after closing, so the sheet keeps its title and actions while it slides out.
    const [menu, setMenu] = useState<{ setUuid: string; label: string } | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [playingUri, setPlayingUri] = useState<string | null>(null);
    // The picker copies the chosen video into the app before handing it over,
    // which takes a while for a long video: shown meanwhile, so the tap isn't lost on nothing.
    const [preparing, setPreparing] = useState(false);
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

    const reload = useCallback(() => {
        setVideos(new Map(listSetVideos().map((v) => [v.set_uuid, v])));
    }, []);

    useFocusEffect(useCallback(() => queueMicrotask(reload), [reload]));

    const context = useMemo<SetVideoContextValue>(() => ({
        videoFor: (setUuid) => (setUuid ? videos.get(setUuid) : undefined),
        open: (setUuid, label) => {
            if (!editable && !videos.has(setUuid)) return;
            setMenu({ setUuid, label });
            setMenuVisible(true);
        },
        editable,
    }), [videos, editable]);

    const openTrim = useCallback((setUuid: string, label: string, source: string, mode: "new" | "edit") => {
        router.push({ pathname: "/workout/set-video", params: { setUuid, label, source, mode } });
    }, [router]);

    const openBarPath = useCallback((setUuid: string, label: string) => {
        router.push({ pathname: "/workout/bar-path", params: { setUuid, label } });
    }, [router]);

    const capture = useCallback(async (setUuid: string, label: string, from: "camera" | "library") => {
        let result: ImagePicker.ImagePickerResult;
        try {
            if (from === "camera") {
                if (!cameraPermission?.granted && !(await requestCameraPermission()).granted) {
                    Alert.alert(t("exercise.setVideo.permissionTitle"), t("exercise.setVideo.cameraPermission"));
                    return;
                }
                setPreparing(true);
                result = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], videoMaxDuration: MAX_RECORDING_SECONDS });
            } else {
                if (!(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted) {
                    Alert.alert(t("exercise.setVideo.permissionTitle"), t("exercise.setVideo.libraryPermission"));
                    return;
                }
                setPreparing(true);
                result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"] });
            }
        } catch (e) {
            // Nothing else would show it: the menu starts this without waiting for it.
            const reason = e instanceof Error ? e.message : String(e);
            logger.warn("[SetVideo] Couldn't get the video", reason);
            Alert.alert(t("exercise.setVideo.openFailedTitle"), t("exercise.setVideo.openFailed", { reason }));
            return;
        } finally {
            setPreparing(false);
        }
        const asset = result.canceled ? null : result.assets[0];
        if (asset) openTrim(setUuid, label, asset.uri, "new");
    }, [cameraPermission, requestCameraPermission, openTrim, t]);

    const share = useCallback(async (video: SetVideo) => {
        if (!(await Sharing.isAvailableAsync())) return;
        const uri = setVideoUri(video);
        await Sharing.shareAsync(uri, { mimeType: uri.endsWith(".mov") ? "video/quicktime" : "video/mp4" });
    }, []);

    const confirmRemove = useCallback((setUuid: string) => {
        Alert.alert(t("exercise.setVideo.removeTitle"), t("exercise.setVideo.removeConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("exercise.setVideo.remove"),
                style: "destructive",
                onPress: () => { removeSetVideo(setUuid); reload(); },
            },
        ]);
    }, [reload, t]);

    const actions = useMemo<ActionSheetItem[]>(() => {
        if (!menu) return [];
        const { setUuid, label } = menu;
        const video = videos.get(setUuid);
        const afterSheet = (fn: () => void) => () => setTimeout(fn, AFTER_SHEET_MS);

        if (!video) {
            return [
                { key: "record", icon: "videocam-outline", label: t("exercise.setVideo.record"), onPress: afterSheet(() => void capture(setUuid, label, "camera")) },
                { key: "library", icon: "images-outline", label: t("exercise.setVideo.pick"), onPress: afterSheet(() => void capture(setUuid, label, "library")) },
            ];
        }
        const items: ActionSheetItem[] = [
            { key: "play", icon: "play-outline", label: t("exercise.setVideo.play"), onPress: () => setPlayingUri(setVideoUri(video)) },
        ];
        // The bar path can be looked at everywhere; tracking it doesn't change the set.
        items.push({ key: "barPath", icon: "analytics-outline", label: t("exercise.setVideo.barPath"), onPress: () => openBarPath(setUuid, label) });
        if (editable && isVideoTrimAvailable()) {
            items.push({ key: "trim", icon: "cut-outline", label: t("exercise.setVideo.trim"), onPress: () => openTrim(setUuid, label, setVideoUri(video), "edit") });
        }
        items.push({ key: "share", icon: "share-outline", label: t("common.share"), onPress: afterSheet(() => void share(video)) });
        if (editable) {
            items.push({ key: "remove", icon: "trash-outline", label: t("exercise.setVideo.remove"), destructive: true, onPress: () => confirmRemove(setUuid) });
        }
        return items;
    }, [menu, videos, editable, capture, openTrim, openBarPath, share, confirmRemove, t]);

    return (
        <SetVideoContext.Provider value={context}>
            {children}
            <ActionSheet
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                title={t("exercise.setVideo.sheetTitle", { set: menu?.label ?? "" })}
                actions={actions}
            />
            <SetVideoPlayer uri={playingUri} onClose={() => setPlayingUri(null)} />
            {preparing && (
                <View style={styles.preparing} accessibilityLiveRegion="polite">
                    <View style={styles.preparingPill}>
                        <ActivityIndicator color={colors.onPrimary} />
                        <Text style={styles.preparingText}>{t("exercise.setVideo.preparing")}</Text>
                    </View>
                </View>
            )}
        </SetVideoContext.Provider>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        // Over the whole screen: nothing else should be started while the video is on its way.
        preparing: {
            ...StyleSheet.absoluteFill,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
        },
        preparingPill: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary,
        },
        preparingText: { color: colors.onPrimary, fontSize: fontSize.sm },
    });
}
