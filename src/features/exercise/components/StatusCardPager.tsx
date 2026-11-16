import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

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
 */
export default function StatusCardPager<K extends string>({ pages, page, onChange, renderPage }: StatusCardPagerProps<K>) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const scrollRef = useRef<ScrollView>(null);
    const [width, setWidth] = useState(0);
    const index = Math.max(0, pages.indexOf(page));

    // Follow a page change from outside, and a width change (which would leave it between pages).
    // Placed by hand rather than with `contentOffset`: Android scrolls to that prop on every
    // render, and a ticking rest re-renders the card every second, snapping a swipe back.
    const placedWidth = useRef(0);
    useEffect(() => {
        if (width === 0) return;
        // The first placement (and a resize) jumps; a page change slides.
        const animated = placedWidth.current === width;
        placedWidth.current = width;
        scrollRef.current?.scrollTo({ x: index * width, animated });
    }, [index, width]);

    function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
        if (width === 0) return;
        const x = e.nativeEvent.contentOffset.x;
        const settled = Math.round(x / width);
        // Only once it has come to rest on a page, not on the way past one.
        if (Math.abs(x - settled * width) < 1 && pages[settled] && pages[settled] !== page) onChange(pages[settled]);
    }

    return (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                onMomentumScrollEnd={handleScroll}
                scrollEventThrottle={32}
            >
                {pages.map((key) => (
                    <View key={key} style={{ width }}>{width > 0 && renderPage(key)}</View>
                ))}
            </ScrollView>
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
        dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: spacing.xs + 2 },
        dot: { width: 5, height: 5, borderRadius: borderRadius.full, backgroundColor: colors.border },
        dotOn: { width: 12, backgroundColor: colors.textTertiary },
    });
}
