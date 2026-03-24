import { borderRadius } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { BackHandler, Keyboard, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

const SPRING_CONFIG = { damping: 130, stiffness: 2000 };

export interface BottomSheetRef {
    snapTo: (index: number) => void;
}

interface BottomSheetProps {
    /** Visible heights in pixels, ascending order (e.g. [160, 600]) */
    snapPoints: number[];
    /** Starting snap index (default 0 = smallest) */
    initialIndex?: number;
    /** Called when the resolved snap index changes */
    onSnapChange?: (index: number) => void;
    children: React.ReactNode;
}

export default forwardRef<BottomSheetRef, BottomSheetProps>(function BottomSheet(
    { snapPoints, initialIndex = 0, onSnapChange, children },
    ref,
) {
    const colors = useThemeColors();
    const maxHeight = snapPoints[snapPoints.length - 1];
    const currentIndex = useRef(initialIndex);

    // translateY: 0 = fully expanded (max snap), (maxHeight - snapPoints[0]) = collapsed
    const translateY = useSharedValue(maxHeight - snapPoints[initialIndex]);
    const startY = useSharedValue(0);

    const notifySnapChange = useCallback(
        (index: number) => {
            if (index !== currentIndex.current) {
                currentIndex.current = index;
                onSnapChange?.(index);
            }
        },
        [onSnapChange],
    );

    useImperativeHandle(ref, () => ({
        snapTo(index: number) {
            const clamped = Math.max(0, Math.min(index, snapPoints.length - 1));
            translateY.value = withSpring(maxHeight - snapPoints[clamped], SPRING_CONFIG);
            notifySnapChange(clamped);
        },
    }));

    const panGesture = Gesture.Pan()
        .onStart(() => {
            "worklet";
            startY.value = translateY.value;
        })
        .onUpdate((e) => {
            "worklet";
            const newY = startY.value + e.translationY;
            const maxY = maxHeight - snapPoints[0];
            translateY.value = Math.max(0, Math.min(newY, maxY));
        })
        .onEnd((e) => {
            "worklet";
            const currentY = translateY.value;
            let bestIndex = 0;
            // Fast flick → jump to boundary
            if (Math.abs(e.velocityY) > 500) {
                bestIndex = e.velocityY > 0 ? 0 : snapPoints.length - 1;
            } else {
                // Snap to nearest point
                let bestDist = Number.MAX_VALUE;
                for (let i = 0; i < snapPoints.length; i++) {
                    const target = maxHeight - snapPoints[i];
                    const dist = Math.abs(currentY - target);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIndex = i;
                    }
                }
            }
            translateY.value = withSpring(maxHeight - snapPoints[bestIndex], SPRING_CONFIG);
            runOnJS(notifySnapChange)(bestIndex);
        });

    // Dismiss-on-back: collapse if expanded, otherwise let the event propagate
    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            if (currentIndex.current > 0) {
                translateY.value = withSpring(maxHeight - snapPoints[0], SPRING_CONFIG);
                currentIndex.current = 0;
                onSnapChange?.(0);
                Keyboard.dismiss();
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [maxHeight, snapPoints, translateY, onSnapChange]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    height: maxHeight,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                },
                animatedStyle,
            ]}
        >
            <GestureDetector gesture={panGesture}>
                <Animated.View style={styles.handleArea}>
                    <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
                </Animated.View>
            </GestureDetector>
            <View style={styles.body}>{children}</View>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
        borderTopWidth: 1,
        elevation: 8,
        overflow: "hidden",
    },
    handleArea: {
        alignItems: "center",
        paddingVertical: 14,
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        opacity: 0.5,
    },
    body: {
        flex: 1,
    },
});
