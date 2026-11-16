import ScreenHeader from "@/src/shared/components/ScreenHeader";
import type { CollapsibleHeaderController } from "@/src/shared/hooks/useCollapsibleHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD_BORDER = 1;
const GAP_BELOW = spacing.sm + 4;

interface CollapsibleHeaderProps {
    header: CollapsibleHeaderController;
    title: string;
    onTitlePress?: () => void;
    right?: React.ReactNode;
    /** The card's always-visible row; it stays pinned once everything else has scrolled away. */
    summary: React.ReactNode;
    /**
     * Pinned too, edge to edge under the summary row (e.g. the log's calorie
     * bar). It doubles as the divider, so the details then go without one.
     */
    summaryFooter?: React.ReactNode;
    /** Revealed under the summary by scrolling up, or by tapping the chevron. */
    details: React.ReactNode;
    /** Makes the whole summary toggle the details (when it holds nothing tappable itself). */
    summaryToggles?: boolean;
}

/**
 * How much of title + details is showing: everything at scroll 0, then the
 * details go first and the title second as the content scrolls down.
 */
function useReveal(scrollY: SharedValue<number>, titleH: SharedValue<number>, detailsH: SharedValue<number>) {
    const reveal = useDerivedValue(() => {
        const total = titleH.get() + detailsH.get();
        return Math.min(Math.max(total - scrollY.get(), 0), total);
    });
    const titleStyle = useAnimatedStyle(() => ({ height: Math.min(reveal.get(), titleH.get()) }));
    // The inner parts slide up as they are clipped, so they tuck under what is above.
    const titleInnerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: Math.min(reveal.get(), titleH.get()) - titleH.get() }],
    }));
    const detailsStyle = useAnimatedStyle(() => ({ height: Math.max(0, reveal.get() - titleH.get()) }));
    const detailsInnerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: Math.max(0, reveal.get() - titleH.get()) - detailsH.get() }],
    }));
    const chevronStyle = useAnimatedStyle(() => {
        const open = detailsH.get() > 0 ? Math.max(0, reveal.get() - titleH.get()) / detailsH.get() : 0;
        return { transform: [{ rotate: `${open * 180}deg` }] };
    });
    return { titleStyle, titleInnerStyle, detailsStyle, detailsInnerStyle, chevronStyle };
}

/**
 * A tab root's header: the large title, then a card whose summary row stays
 * pinned while its details and the title scroll away. Pair it with
 * `useCollapsibleHeader`, whose `scrollProps` and `contentStyle` go on the
 * screen's scroll view; render it as the screen's first child.
 */
export default function CollapsibleHeader({
    header, title, onTitlePress, right, summary, summaryFooter, details, summaryToggles,
}: CollapsibleHeaderProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const reveal = useReveal(header.scrollY, header.titleH, header.detailsH);
    const { setBaseHeight } = header;

    function onSummaryLayout(e: LayoutChangeEvent) {
        setBaseHeight(insets.top + e.nativeEvent.layout.height + 2 * CARD_BORDER + GAP_BELOW);
    }

    const summaryBody = summaryToggles ? (
        <Pressable onPress={header.toggle} style={styles.summaryBody} accessibilityRole="button">
            {summary}
        </Pressable>
    ) : (
        <View style={styles.summaryBody}>{summary}</View>
    );

    return (
        <View style={[styles.overlay, { paddingTop: insets.top }, !header.ready && styles.hidden]}>
            <Animated.View style={[styles.clip, reveal.titleStyle]}>
                <Animated.View onLayout={header.onTitleLayout} style={[styles.clipped, reveal.titleInnerStyle]}>
                    <ScreenHeader
                        variant="large"
                        safeArea={false}
                        title={title}
                        onTitlePress={onTitlePress}
                        right={right}
                    />
                </Animated.View>
            </Animated.View>

            <View style={styles.cardWrap}>
                <View style={styles.card}>
                    <View onLayout={onSummaryLayout}>
                        <View style={styles.summaryRow}>
                            {summaryBody}
                            <Pressable
                                onPress={header.toggle}
                                hitSlop={8}
                                style={styles.chevron}
                                accessibilityRole="button"
                                accessibilityLabel={t("common.toggleDetails")}
                            >
                                <Animated.View style={reveal.chevronStyle}>
                                    <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
                                </Animated.View>
                            </Pressable>
                        </View>
                        {summaryFooter}
                    </View>
                    <Animated.View style={[styles.clip, reveal.detailsStyle]}>
                        <Animated.View onLayout={header.onDetailsLayout} style={[styles.clipped, reveal.detailsInnerStyle]}>
                            <View style={[styles.details, !!summaryFooter && styles.detailsNoDivider]}>{details}</View>
                        </Animated.View>
                    </Animated.View>
                </View>
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        // Floats over the content, which reserves room for it with `contentStyle`.
        overlay: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            backgroundColor: colors.background,
        },
        hidden: { opacity: 0 },
        clip: { overflow: "hidden" },
        // Out of flow, so it keeps its natural height (and reports it) however small the clip gets.
        clipped: { position: "absolute", top: 0, left: 0, right: 0 },
        cardWrap: { paddingHorizontal: screenPadding, paddingBottom: GAP_BELOW },
        card: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: CARD_BORDER,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
        },
        summaryRow: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 56,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs,
        },
        summaryBody: { flex: 1, paddingVertical: spacing.sm + 2 },
        chevron: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
        details: {
            marginHorizontal: spacing.md,
            paddingTop: spacing.sm + 4,
            paddingBottom: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        detailsNoDivider: { borderTopWidth: 0, paddingTop: spacing.md },
    });
}
