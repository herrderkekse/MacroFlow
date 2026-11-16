import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated, {
    scrollTo,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useSharedValue,
    type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** A ScrollView or FlatList instance — whichever the screen scrolls with. */
interface Scrollable {
    scrollTo?: (options: { y: number; animated?: boolean }) => void;
    scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
}

function scrollNode(node: Scrollable | null | undefined, y: number, animated: boolean) {
    if (!node) return;
    if (node.scrollToOffset) node.scrollToOffset({ offset: y, animated });
    else node.scrollTo?.({ y, animated });
}

/** Heights of the header's pieces; -1 until measured. */
interface Measurements {
    /** The title row, which scrolls away second. */
    title: number;
    /** The card's details, which scroll away first. */
    details: number;
    /** What always stays: safe-area inset, the card's summary row, the gap below. */
    base: number;
    /** The scroll view's own height. */
    viewport: number;
}

const UNMEASURED: Measurements = { title: -1, details: -1, base: -1, viewport: -1 };

/** Spread onto the screen's main `Animated.ScrollView` / `Animated.FlatList`. */
export interface CollapsibleScrollProps {
    ref: (node: Scrollable | null) => void;
    onScroll: ReturnType<typeof useAnimatedScrollHandler>;
    scrollEventThrottle: number;
    onLayout: (e: LayoutChangeEvent) => void;
    onContentSizeChange: (width: number, height: number) => void;
    style?: StyleProp<ViewStyle>;
}

/** Spread onto a scroll view that mirrors the main one (the log's neighbouring days). */
export interface CollapsibleFollowerProps {
    ref: (node: Scrollable | null) => void;
    onContentSizeChange: () => void;
}

export interface CollapsibleHeaderController {
    scrollY: SharedValue<number>;
    titleH: SharedValue<number>;
    detailsH: SharedValue<number>;
    /** False until the list has been parked at its resting offset; hide everything until then. */
    ready: boolean;
    /** Merge into the scroll view's `contentContainerStyle`. */
    contentStyle: ViewStyle;
    scrollProps: CollapsibleScrollProps;
    followerProps: (key: string) => CollapsibleFollowerProps;
    onTitleLayout: (e: LayoutChangeEvent) => void;
    onDetailsLayout: (e: LayoutChangeEvent) => void;
    setBaseHeight: (height: number) => void;
    /** Opens the details, or tucks them away again. */
    toggle: () => void;
    /** Shows the top of the content again, keeping the header as it is (e.g. after a day switch). */
    settle: () => void;
}

const HIDDEN: ViewStyle = { opacity: 0 };
/** Frames pairs to wait for the first jump to the resting offset before showing anyway. */
const MAX_PARK_TRIES = 10;

/**
 * Drives a tab root's collapsing header (see `CollapsibleHeader`) from the
 * scroll position alone — no gesture state machine.
 *
 * The content reserves room for the whole header above it and rests at
 * `scrollY = details`: title and summary showing, details tucked away.
 * Scrolling up from there pulls the details out; scrolling down first tucks
 * the details away, then the title, and only then moves the content while the
 * card's summary row stays pinned.
 */
export function useCollapsibleHeader(): CollapsibleHeaderController {
    const [m, setM] = useState<Measurements>(UNMEASURED);
    const [ready, setReady] = useState(false);
    // The latest measurements for callbacks; `update` is the only writer.
    const mRef = useRef(m);

    const scrollY = useSharedValue(0);
    const titleH = useSharedValue(0);
    const detailsH = useSharedValue(0);

    const primary = useRef<Scrollable | null>(null);
    const followers = useRef(new Map<string, Scrollable | null>());
    const contentHeight = useRef(0);
    const parked = useRef(false);

    /** Offset at which title and details are both gone. */
    const collapsedAt = () => Math.max(0, mRef.current.title) + Math.max(0, mRef.current.details);

    const syncFollowers = useCallback((y: number) => {
        // A neighbour only needs to line its top up with the header's bottom.
        const target = Math.min(Math.max(0, y), collapsedAt());
        followers.current.forEach((node) => scrollNode(node, target, false));
    }, []);

    const tryPark = useCallback(() => {
        const cur = mRef.current;
        if (parked.current || cur.title < 0 || cur.details < 0 || cur.base < 0 || cur.viewport <= 0) return;
        // Wait until the min-height padding has been laid out, or the offset gets clamped.
        if (contentHeight.current < cur.viewport + cur.title + cur.details - 1) return;
        parked.current = true;
        const target = cur.details;
        // The native view can lag behind the content size it just reported and
        // clamp the jump, so check against real scroll events and try again.
        const attempt = (tries: number) => {
            scrollNode(primary.current, target, false);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (Math.abs(scrollY.get() - target) > 1 && tries < MAX_PARK_TRIES) {
                    attempt(tries + 1);
                    return;
                }
                syncFollowers(target);
                setReady(true);
            }));
        };
        attempt(1);
    }, [scrollY, syncFollowers]);

    const update = useCallback((patch: Partial<Measurements>) => {
        const prev = mRef.current;
        const next = { ...prev, ...patch };
        if (Object.keys(patch).every((k) => Math.abs(prev[k as keyof Measurements] - next[k as keyof Measurements]) < 0.5)) return;
        mRef.current = next;
        setM(next);

        // Already parked and a piece changed size: keep a closed part closed by
        // moving the offset along with the reserved room, so nothing jumps.
        if (parked.current && prev.details >= 0 && prev.title >= 0) {
            const y = scrollY.get();
            let shift = 0;
            if (y >= prev.details - 0.5) shift += next.details - prev.details;
            if (y >= prev.details + prev.title - 0.5) shift += next.title - prev.title;
            if (shift !== 0) {
                requestAnimationFrame(() => {
                    scrollNode(primary.current, y + shift, false);
                    syncFollowers(y + shift);
                });
            }
        }
    }, [scrollY, syncFollowers]);

    const onTitleLayout = useCallback((e: LayoutChangeEvent) => {
        const h = e.nativeEvent.layout.height;
        titleH.set(h);
        update({ title: h });
    }, [titleH, update]);

    const onDetailsLayout = useCallback((e: LayoutChangeEvent) => {
        const h = e.nativeEvent.layout.height;
        detailsH.set(h);
        update({ details: h });
    }, [detailsH, update]);

    const setBaseHeight = useCallback((h: number) => update({ base: h }), [update]);

    const animatedRef = useAnimatedRef<Animated.ScrollView>();
    // Set when a gesture starts below the resting offset: neither the drag nor
    // its fling may go past rest, so opening the details always takes a
    // gesture of its own that starts there.
    const stopAtRest = useSharedValue(false);

    const onScroll = useAnimatedScrollHandler({
        onBeginDrag: (e) => {
            stopAtRest.set(e.contentOffset.y > detailsH.get() + 1);
        },
        onScroll: (e) => {
            const y = e.contentOffset.y;
            const rest = detailsH.get();
            if (stopAtRest.get() && y < rest) {
                scrollTo(animatedRef, 0, rest, false);
                scrollY.set(rest);
                scheduleOnRN(syncFollowers, rest);
                return;
            }
            scrollY.set(y);
        },
        onEndDrag: (e) => {
            scheduleOnRN(syncFollowers, e.contentOffset.y);
        },
        onMomentumEnd: (e) => {
            stopAtRest.set(false);
            scheduleOnRN(syncFollowers, e.contentOffset.y);
        },
    });

    const toggle = useCallback(() => {
        const details = Math.max(0, mRef.current.details);
        // Open if the details are mostly hidden, otherwise tuck them away.
        const target = scrollY.get() > details / 2 ? 0 : details;
        stopAtRest.set(false);
        scrollNode(primary.current, target, true);
        syncFollowers(target);
    }, [scrollY, stopAtRest, syncFollowers]);

    const settle = useCallback(() => {
        if (!parked.current) return;
        stopAtRest.set(false);
        const target = Math.min(Math.max(0, scrollY.get()), collapsedAt());
        if (target !== scrollY.get()) scrollNode(primary.current, target, false);
        syncFollowers(target);
    }, [scrollY, stopAtRest, syncFollowers]);

    const scrollProps = useMemo<CollapsibleScrollProps>(() => ({
        ref: (node) => {
            primary.current = node;
            // The same view, for scrolling from the UI thread.
            (animatedRef as unknown as (n: Scrollable | null) => void)(node);
        },
        onScroll,
        scrollEventThrottle: 16,
        onLayout: (e) => {
            update({ viewport: e.nativeEvent.layout.height });
            tryPark();
        },
        onContentSizeChange: (_w, h) => {
            contentHeight.current = h;
            tryPark();
        },
        style: ready ? undefined : HIDDEN,
    }), [animatedRef, onScroll, ready, tryPark, update]);

    const followerProps = useCallback((key: string): CollapsibleFollowerProps => ({
        ref: (node) => {
            followers.current.set(key, node);
        },
        onContentSizeChange: () => {
            if (parked.current) scrollNode(followers.current.get(key), Math.min(Math.max(0, scrollY.get()), collapsedAt()), false);
        },
    }), [scrollY]);

    // Leaving the tab tucks open details away, so it is back at rest on return.
    useFocusEffect(
        useCallback(() => () => {
            const rest = Math.max(0, mRef.current.details);
            if (!parked.current || scrollY.get() >= rest) return;
            stopAtRest.set(false);
            scrollNode(primary.current, rest, false);
            scrollY.set(rest);
            syncFollowers(rest);
        }, [scrollY, stopAtRest, syncFollowers]),
    );

    // Re-check parking whenever a measurement lands.
    useEffect(() => {
        const frame = requestAnimationFrame(tryPark);
        return () => cancelAnimationFrame(frame);
    }, [m, tryPark]);

    const title = Math.max(0, m.title);
    const details = Math.max(0, m.details);
    const contentStyle = useMemo<ViewStyle>(() => ({
        paddingTop: Math.max(0, m.base) + title + details,
        // Always enough room to scroll the title and details away, however short the content.
        minHeight: Math.max(0, m.viewport) + title + details,
    }), [m.base, m.viewport, title, details]);

    return {
        scrollY, titleH, detailsH, ready, contentStyle, scrollProps, followerProps,
        onTitleLayout, onDetailsLayout, setBaseHeight, toggle, settle,
    };
}
