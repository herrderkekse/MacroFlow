import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "react-native";
import { useSetVideo } from "../hooks/useSetVideo";
import { createSetInputStyles } from "./SetInputHelpers";

interface SetLabelCellProps {
    label: string;
    color: string;
    setUuid: string | null;
    /** Offer a video on this row even before it has one (the set being done). */
    showAddHint?: boolean;
    onLongPress?: () => void;
}

/**
 * A set row's number ("A3"). A tap opens the set's video menu. A set with a
 * video shows a solid camera instead of its number; the set being done shows
 * an outline camera instead, inviting one.
 */
export default function SetLabelCell({ label, color, setUuid, showAddHint = false, onLongPress }: SetLabelCellProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createSetInputStyles(colors), [colors]);
    const { t } = useTranslation();
    const setVideo = useSetVideo(setUuid);
    const hasVideo = !!setVideo?.video;
    const canOpen = !!setVideo && (hasVideo || setVideo.editable);

    return (
        <Pressable
            onPress={canOpen ? () => setVideo.open(label) : undefined}
            onLongPress={onLongPress}
            style={styles.setCol}
            hitSlop={4}
            accessibilityRole={canOpen ? "button" : undefined}
            accessibilityLabel={canOpen ? t("exercise.setVideo.openLabel", { set: label }) : undefined}
        >
            {/* Where a camera is shown, it takes the number's place. */}
            {hasVideo ? (
                <Ionicons name="videocam" size={16} color={colors.text} />
            ) : showAddHint && canOpen ? (
                <Ionicons name="videocam-outline" size={16} color={color} />
            ) : (
                <Text style={[styles.setLabel, { color }]}>{label}</Text>
            )}
        </Pressable>
    );
}
