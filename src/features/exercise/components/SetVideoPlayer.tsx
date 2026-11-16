import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { spacing, type ThemeColors } from "@/src/utils/theme";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SetVideoPlayerProps {
    /** The video to play; null keeps the player closed. */
    uri: string | null;
    onClose: () => void;
}

/** A set's video full screen, with the platform's own playback controls. */
export default function SetVideoPlayer({ uri, onClose }: SetVideoPlayerProps) {
    return (
        <Modal visible={uri != null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            {uri != null && <PlayerContent uri={uri} onClose={onClose} />}
        </Modal>
    );
}

function PlayerContent({ uri, onClose }: { uri: string; onClose: () => void }) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.play();
    });

    return (
        <View style={styles.screen}>
            {/* A SurfaceView isn't drawn inside a Modal's window on Android; a TextureView is. */}
            <VideoView player={player} style={styles.video} contentFit="contain" nativeControls surfaceType="textureView" />
            <IconButton
                icon="close"
                variant="outline"
                label={t("common.close")}
                onPress={onClose}
                style={[styles.close, { top: insets.top + spacing.sm }]}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        video: { flex: 1 },
        close: { position: "absolute", left: spacing.md },
    });
}
