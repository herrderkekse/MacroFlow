import { VideoView, type VideoPlayer } from "expo-video";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { clampShift, clampZoom, cropFrame, videoRect, zoomAbout, type Size } from "../helpers/cropGeometry";
import type { CropState } from "../hooks/useCrop";

// Drawn over the video, so it must not follow the theme (see BarPathOverlay).
const INK = "#FFFFFF";
const SHADE = "rgba(0, 0, 0, 0.55)";

interface CroppableVideoProps {
    player: VideoPlayer;
    /** The video's box in the stage. */
    box: Size;
    /** The video's shape (width over height); the picture is fitted into the box whole. */
    aspect: number | null;
    /** The crop being set, or null to show the whole video untouched. */
    crop: CropState | null;
    /** Everything else drawn over the video (a tap target, a badge). */
    children?: React.ReactNode;
}

/**
 * The video, and while cropping, the frame of the chosen shape over it: the
 * video zooms with a pinch and moves with a drag under the frame, and what
 * lies outside it is shaded.
 */
export default function CroppableVideo({ player, box: outer, aspect, crop, children }: CroppableVideoProps) {
    // Where the picture lies in the box: all of it, unless the box couldn't
    // take the video's shape (a very tall video), when it has bars beside it.
    // Cropping works in the picture's own rectangle.
    const picture = pictureRect(outer, aspect);
    const box = useMemo(() => ({ width: picture.width, height: picture.height }), [picture.width, picture.height]);
    // The picture's size on the UI thread, for the gestures and the video's style.
    const boxSize = useSharedValue(box);
    useEffect(() => { boxSize.set(box); }, [box, boxSize]);
    const active = crop != null;
    const ratio = crop?.ratio ?? null;
    const frame = cropFrame(box, ratio);
    const gridOpacity = useSharedValue(0);

    // Stand-ins when not cropping, so the hooks below always run the same.
    const idleZoom = useSharedValue(1);
    const idleShift = useSharedValue(0);
    const zoom = crop?.zoom ?? idleZoom;
    const shiftX = crop?.shiftX ?? idleShift;
    const shiftY = crop?.shiftY ?? idleShift;
    const commit = crop?.commit;

    const gesture = useMemo(() => {
        const settle = (b: Size, z: number) => {
            "worklet";
            const f = cropFrame(b, ratio);
            const c = clampShift(b, f, z, shiftX.get() * b.width, shiftY.get() * b.height);
            shiftX.set(c.x / b.width);
            shiftY.set(c.y / b.height);
        };
        const end = () => {
            "worklet";
            gridOpacity.set(withTiming(0, { duration: 200 }));
            if (commit) runOnJS(commit)(ratio);
        };
        const pinch = Gesture.Pinch()
            .enabled(active)
            .onStart(() => { gridOpacity.set(withTiming(1, { duration: 120 })); })
            .onChange((e) => {
                const b = boxSize.get();
                const from = zoom.get();
                const to = clampZoom(from * e.scaleChange);
                const s = zoomAbout(b, from, to, shiftX.get() * b.width, shiftY.get() * b.height, e.focalX, e.focalY);
                zoom.set(to);
                shiftX.set(s.x / b.width);
                shiftY.set(s.y / b.height);
                settle(b, to);
            })
            .onEnd(end);
        const pan = Gesture.Pan()
            .enabled(active)
            .maxPointers(2)
            .onStart(() => { gridOpacity.set(withTiming(1, { duration: 120 })); })
            .onChange((e) => {
                const b = boxSize.get();
                shiftX.set(shiftX.get() + e.changeX / b.width);
                shiftY.set(shiftY.get() + e.changeY / b.height);
                settle(b, zoom.get());
            })
            .onEnd(end);
        return Gesture.Simultaneous(pinch, pan);
    }, [active, ratio, boxSize, zoom, shiftX, shiftY, gridOpacity, commit]);

    // The video is laid out zoomed and shifted (not transformed: a video
    // surface doesn't follow a scale), and the box clips it.
    const videoStyle = useAnimatedStyle(() => {
        const b = boxSize.get();
        const r = active ? videoRect(b, zoom.get(), shiftX.get() * b.width, shiftY.get() * b.height) : { left: 0, top: 0, width: b.width, height: b.height };
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const gridStyle = useAnimatedStyle(() => ({ opacity: gridOpacity.get() }));
    const shaded = active && ratio != null;

    return (
        <GestureDetector gesture={gesture}>
            <View style={StyleSheet.absoluteFill}>
                <View style={[styles.picture, picture]} pointerEvents="box-none">
                <Animated.View style={[styles.video, videoStyle]}>
                    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
                </Animated.View>
                {shaded && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <View style={[styles.shade, { left: 0, right: 0, top: 0, height: frame.top }]} />
                        <View style={[styles.shade, { left: 0, right: 0, top: frame.top + frame.height, bottom: 0 }]} />
                        <View style={[styles.shade, { left: 0, width: frame.left, top: frame.top, height: frame.height }]} />
                        <View style={[styles.shade, { left: frame.left + frame.width, right: 0, top: frame.top, height: frame.height }]} />
                        <View style={[styles.frame, frame]} />
                    </View>
                )}
                {active && (
                    // Thirds, while the video is being moved, to line it up by.
                    <Animated.View style={[styles.grid, frame, gridStyle]} pointerEvents="none">
                        {[1, 2].map((i) => (
                            <React.Fragment key={i}>
                                <View style={[styles.line, { left: `${(i * 100) / 3}%`, top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />
                                <View style={[styles.line, { top: `${(i * 100) / 3}%`, left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />
                            </React.Fragment>
                        ))}
                    </Animated.View>
                )}
                </View>
                {children}
            </View>
        </GestureDetector>
    );
}

/** The picture fitted whole into the box, centred. */
function pictureRect(box: Size, aspect: number | null) {
    if (!aspect || box.width <= 0 || box.height <= 0) return { left: 0, top: 0, width: box.width, height: box.height };
    const width = Math.min(box.width, box.height * aspect);
    const height = width / aspect;
    return { left: (box.width - width) / 2, top: (box.height - height) / 2, width, height };
}

const styles = StyleSheet.create({
    picture: { position: "absolute", overflow: "hidden" },
    video: { position: "absolute" },
    shade: { position: "absolute", backgroundColor: SHADE },
    frame: { position: "absolute", borderWidth: 2, borderColor: INK },
    grid: { position: "absolute" },
    line: { position: "absolute", backgroundColor: INK, opacity: 0.6 },
});
