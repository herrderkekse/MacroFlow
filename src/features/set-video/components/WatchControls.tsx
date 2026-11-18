import { spacing } from "@/src/utils/theme";
import React from "react";
import { StyleSheet, View } from "react-native";
import type { VideoPlayback } from "../hooks/useVideoPlayback";
import PlaybackControls from "./PlaybackControls";
import VideoTimeline, { type TimelineMark } from "./VideoTimeline";

interface WatchControlsProps {
    playback: VideoPlayback;
    marks?: TimelineMark[];
}

/** The timeline to scrub through the video, and the buttons to play it or step through it. */
export default function WatchControls({ playback, marks }: WatchControlsProps) {
    return (
        <View style={styles.area}>
            <VideoTimeline playback={playback} marks={marks} />
            <PlaybackControls playback={playback} />
        </View>
    );
}

const styles = StyleSheet.create({
    // Inset past the screen edge's back-swipe zone, as the trim bar is, so scrubbing doesn't leave the screen.
    area: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
