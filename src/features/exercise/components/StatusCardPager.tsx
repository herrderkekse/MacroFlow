import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** A drag further than this share of the width, or a flick, turns the page. */
const TURN_FRACTION = 0.25;
const TURN_VELOCITY = 500;
/** Movement before the drag counts as a swipe; a tap or a vertical drag stays below it. */
const ACTIVATE_X = 12;
const FAIL_Y = 12;
/** Past the first and last page the strip only gives a little. */
const EDGE_RESISTANCE = 0.3;
const SLIDE_MS = 220;

interface StatusCardPagerProps<K extends string> {
    pages: K[];
    page: K;
    onChange: (page: K) => void;
    renderPage: (page: K) => React.ReactNode;
}

/**
 * The pinned card's summaries side by side, one per page: swiped through by
 * hand, or moved to a page from outside (`page`). Dots under them say which
 * page is showing.
 *
 * `page` is the only state: the strip is always placed from it, and a swipe
 * only asks for the next or previous page. (A paging ScrollView, which keeps
 * its own position, lost track of it whenever the card changed size under
 * it — the chevron coming and going, details opening.)
 */
export default function StatusCardPager<K extends string>({ pages, page, onChange, renderPage }: StatusCardPagerProps<K>) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [width, setWidth] = useState(0);
    const index = Math.max(0, pages.indexOf(page));

    const widthSV = useSharedValue(0);
    const indexSV = useSharedValue(index);
    const countSV = useSharedValue(pages.length);
    /** Where the strip sits, in pages (fractional while sliding). */
    const position = useSharedValue(index);
    const drag = useSharedValue(0);

    const turnTo = (target: number) => {
        const key = pages[target];
        if (key) onChange(key);
    };

    // Declared before the effects: the gesture writes these shared values, and a shared
    // value may not be written once an effect has captured it (see Sheet).
    const pan = Gesture.Pan()
        .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
        .failOffsetY([-FAIL_Y, FAIL_Y])
        .onUpdate((e) => {
            "worklet";
            const atStart = indexSV.value === 0 && e.translationX > 0;
            const atEnd = indexSV.value === countSV.value - 1 && e.translationX < 0;
            drag.value = atStart || atEnd ? e.translationX * EDGE_RESISTANCE : e.translationX;
        })
        .onEnd((e) => {
            "worklet";
            const w = widthSV.value;
            if (w === 0) {
                drag.value = 0;
                return;
            }
            let target = indexSV.value;
            if (e.translationX < -w * TURN_FRACTION || e.velocityX < -TURN_VELOCITY) target += 1;
            else if (e.translationX > w * TURN_FRACTION || e.velocityX > TURN_VELOCITY) target -= 1;
            target = Math.min(countSV.value - 1, Math.max(0, target));
            // Hand the drag over to the position, so the strip slides on from where it was let go.
            position.value = indexSV.value - drag.value / w;
            drag.value = 0;
            position.value = withTiming(target, { duration: SLIDE_MS });
            if (target !== indexSV.value) {
                indexSV.value = target;
                scheduleOnRN(turnTo, target);
            }
        });

    useEffect(() => {
        widthSV.value = width;
    }, [width, widthSV]);

    useEffect(() => {
        countSV.value = pages.length;
    }, [pages.length, countSV]);

    useEffect(() => {
        indexSV.value = index;
        position.value = withTiming(index, { duration: SLIDE_MS });
    }, [index, indexSV, position]);

    const stripStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: -position.value * widthSV.value + drag.value }],
    }));

    return (
        <View>
            <GestureDetector gesture={pan}>
                <View style={styles.viewport} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                    <Animated.View style={[styles.strip, stripStyle]}>
                        {pages.map((key) => (
                            <View key={key} style={{ width }}>{width > 0 && renderPage(key)}</View>
                        ))}
                    </Animated.View>
                </View>
            </GestureDetector>
            {pages.length > 1 && (
                <View style={styles.dots} accessible={false}>
                    {pages.map((key) => <View key={key} style={[styles.dot, key === page && styles.dotOn]} />)}
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        viewport: { overflow: "hidden" },
        strip: { flexDirection: "row" },
        dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: spacing.xs + 2 },
        dot: { width: 5, height: 5, borderRadius: borderRadius.full, backgroundColor: colors.border },
        dotOn: { width: 12, backgroundColor: colors.textTertiary },
    });
}
