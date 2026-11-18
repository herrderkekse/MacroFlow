import Notice from "@/src/shared/atoms/Notice";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing } from "@/src/utils/theme";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import SetVideoEditor from "../components/SetVideoEditor";
import { getSetVideo } from "../services/setVideoDb";
import { setVideoUri } from "../services/setVideoFiles";

type Params = {
    setUuid: string;
    label: string;
    /** A video just recorded or picked, to trim and attach; without it, the set's stored video. */
    source?: string;
    /** "1" where sets are only looked at (history). */
    readOnly?: string;
};

/**
 * A set's video: opened right after recording or picking one (to cut it to
 * the part worth keeping), and from the set's video button once it has one
 * (to watch it, trim it further and track its bar path).
 */
export default function SetVideoScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const { setUuid, label, source, readOnly } = useLocalSearchParams<Params>();
    const [video, setVideo] = useState(() => (source ? undefined : getSetVideo(setUuid)));
    const reload = useCallback(() => setVideo(getSetVideo(setUuid)), [setUuid]);

    if (source) {
        return <SetVideoEditor setUuid={setUuid} label={label} uri={source} isNew editable onTrimmed={reload} />;
    }
    if (!video) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <ScreenHeader title={t("exercise.setVideo.watchTitle")} subtitle={t("exercise.setVideo.sheetTitle", { set: label })} />
                <View style={styles.missing}>
                    <Notice>{t("barPath.missing")}</Notice>
                </View>
            </View>
        );
    }
    return (
        // Trimming makes it another file: everything starts over with the new one.
        <SetVideoEditor
            key={video.file_name}
            setUuid={setUuid}
            label={label}
            uri={setVideoUri(video)}
            isNew={false}
            editable={readOnly !== "1"}
            onTrimmed={reload}
        />
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    missing: { paddingHorizontal: screenPadding, paddingTop: spacing.md },
});
