import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius } from "@/src/utils/theme";
import { Image } from "expo-image";
import type { VideoThumbnail } from "expo-video";
import React from "react";
import { StyleSheet, View } from "react-native";
import { FILMSTRIP } from "../constants";

interface FilmstripProps {
    thumbnails: VideoThumbnail[];
    /** Rounds the strip's own ends; off where trim handles cap them. */
    rounded?: boolean;
}

/** The video as a row of frames, laid over the bar it sits in. */
export default function Filmstrip({ thumbnails, rounded = false }: FilmstripProps) {
    const colors = useThemeColors();
    return (
        <View style={[styles.strip, rounded && styles.rounded, { backgroundColor: colors.surfaceMuted }]} pointerEvents="none">
            {thumbnails.map((thumb, i) => (
                <Image key={i} source={thumb} style={styles.thumb} contentFit="cover" />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    strip: {
        position: "absolute",
        left: FILMSTRIP.endInset,
        right: FILMSTRIP.endInset,
        top: FILMSTRIP.border,
        bottom: FILMSTRIP.border,
        flexDirection: "row",
        overflow: "hidden",
    },
    rounded: { borderRadius: borderRadius.sm },
    thumb: { flex: 1, height: "100%" },
});
