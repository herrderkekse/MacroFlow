import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export interface SegmentOption<T extends string | number> {
    key: T;
    label: string;
    icon?: React.ComponentProps<typeof Ionicons>["name"];
}

interface SegmentedControlProps<T extends string | number> {
    options: SegmentOption<T>[];
    value: T | null;
    onChange: (key: T) => void;
    size?: "sm" | "md";
    /**
     * Shows only the options' icons, each in a square, with the label read out
     * by screen readers (a mode switch in a header). Every option needs an icon.
     */
    iconOnly?: boolean;
    style?: StyleProp<ViewStyle>;
}

const TRACK_PAD = 3;
const GAP = 3;

/**
 * The one control for a choice that always has exactly one answer — however
 * many options there are (meal, units, appearance, a chart's metric).
 * Options share the width equally while they fit; otherwise they keep their
 * natural width and scroll sideways inside the frame. Choices that may be
 * empty, or allow several at once, are `Chip`s instead.
 */
export default function SegmentedControl<T extends string | number>({
    options,
    value,
    onChange,
    size = "md",
    iconOnly = false,
    style,
}: SegmentedControlProps<T>) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [trackWidth, setTrackWidth] = useState(0);
    const [naturalWidth, setNaturalWidth] = useState(0);
    const scrolls = trackWidth > 0 && naturalWidth > trackWidth;

    const scrollRef = useRef<ScrollView>(null);
    // Which ends have options past them, so a fade can say "there is more".
    const [more, setMore] = useState({ start: false, end: true });
    const segmentX = useRef(new Map<string, { x: number; width: number }>());

    // Keep the selected option in view when the row scrolls.
    useEffect(() => {
        if (!scrolls || value == null) return;
        const frame = requestAnimationFrame(() => {
            const seg = segmentX.current.get(String(value));
            if (!seg) return;
            const inner = trackWidth - 2 * TRACK_PAD;
            scrollRef.current?.scrollTo({ x: Math.max(0, seg.x + seg.width / 2 - inner / 2), animated: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [scrolls, value, trackWidth]);

    function renderSegment(option: SegmentOption<T>, natural: boolean) {
        const isSelected = option.key === value;
        const tint = isSelected ? colors.onPrimary : colors.textSecondary;
        return (
            <Pressable
                key={String(option.key)}
                onPress={() => onChange(option.key)}
                onLayout={natural ? (e) => segmentX.current.set(String(option.key), e.nativeEvent.layout) : undefined}
                accessibilityRole="tab"
                accessibilityLabel={iconOnly ? option.label : undefined}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                    styles.segment,
                    iconOnly ? styles.segmentIcon : natural ? styles.segmentNatural : styles.segmentShared,
                    size === "sm" && styles.segmentSmall,
                    iconOnly && size === "sm" && styles.segmentIconSmall,
                    isSelected && styles.segmentSelected,
                    pressed && !isSelected && styles.pressed,
                ]}
            >
                {option.icon && <Ionicons name={option.icon} size={iconOnly && size === "md" ? 18 : 16} color={tint} />}
                {!iconOnly && <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit={!natural}
                    minimumFontScale={0.8}
                    style={[styles.label, { color: tint }, isSelected && styles.labelSelected]}
                >
                    {option.label}
                </Text>}
            </Pressable>
        );
    }

    // Squares of a fixed size: nothing to measure, nothing to scroll.
    if (iconOnly) {
        return (
            <View style={[styles.track, style]} accessibilityRole="tablist">
                {options.map((option) => renderSegment(option, false))}
            </View>
        );
    }

    return (
        <View style={[styles.track, style]} accessibilityRole="tablist" onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
            {/* Measures the options at their natural width, off screen and
                unbounded, to decide whether they fit. */}
            <ScrollView
                horizontal
                style={styles.measure}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                contentContainerStyle={styles.row}
                onContentSizeChange={(w) => setNaturalWidth(w + 2 * TRACK_PAD + 2)}
            >
                {options.map((option) => (
                    <View key={String(option.key)} style={[styles.segment, styles.segmentNatural]}>
                        {option.icon && <Ionicons name={option.icon} size={16} />}
                        <Text numberOfLines={1} style={[styles.label, styles.labelSelected]}>{option.label}</Text>
                    </View>
                ))}
            </ScrollView>

            {scrolls ? (
                <View style={styles.scroller}>
                    <ScrollView
                        ref={scrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.row}
                        scrollEventThrottle={32}
                        onScroll={(e) => {
                            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                            const start = contentOffset.x > 1;
                            const end = contentOffset.x + layoutMeasurement.width < contentSize.width - 1;
                            if (start !== more.start || end !== more.end) setMore({ start, end });
                        }}
                    >
                        {options.map((option) => renderSegment(option, true))}
                    </ScrollView>
                    {more.start && (
                        <LinearGradient
                            pointerEvents="none"
                            colors={[colors.surface, `${colors.surface}00`]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.fade, styles.fadeStart]}
                        >
                            <Ionicons name="chevron-back" size={14} color={colors.textTertiary} />
                        </LinearGradient>
                    )}
                    {more.end && (
                        <LinearGradient
                            pointerEvents="none"
                            colors={[`${colors.surface}00`, colors.surface]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.fade, styles.fadeEnd]}
                        >
                            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                        </LinearGradient>
                    )}
                </View>
            ) : (
                options.map((option) => renderSegment(option, false))
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        track: {
            flexDirection: "row",
            gap: GAP,
            padding: TRACK_PAD,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: "hidden",
        },
        measure: { position: "absolute", height: 0, opacity: 0 },
        row: { flexDirection: "row", gap: GAP },
        scroller: { flex: 1 },
        // A fade with a chevron at each end that has options past it.
        fade: { position: "absolute", top: 0, bottom: 0, width: 36, justifyContent: "center" },
        fadeStart: { left: 0, alignItems: "flex-start" },
        fadeEnd: { right: 0, alignItems: "flex-end" },
        segment: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: controlHeight.md - 8,
            borderRadius: borderRadius.md - 3,
        },
        segmentShared: { flex: 1, paddingHorizontal: 6 },
        segmentNatural: { paddingHorizontal: 14 },
        segmentSmall: { minHeight: controlHeight.sm - 8 },
        segmentIcon: { width: controlHeight.md - 8 },
        segmentIconSmall: { width: controlHeight.sm - 8 },
        segmentSelected: { backgroundColor: colors.primary },
        pressed: { backgroundColor: colors.surfaceMuted },
        label: { fontSize: fontSize.sm, fontWeight: "500", flexShrink: 1 },
        labelSelected: { fontWeight: "600" },
    });
}
