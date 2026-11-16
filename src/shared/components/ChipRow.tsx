import { spacing } from "@/src/utils/theme";
import React from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

interface ChipRowProps {
    children: React.ReactNode;
    /** Scroll sideways when the chips do not fit, instead of wrapping onto more lines. */
    scroll?: boolean;
    /**
     * With `scroll`: how far the row reaches past its container on each side,
     * so chips scroll out to the screen edge (usually `screenPadding`).
     */
    bleed?: number;
    style?: StyleProp<ViewStyle>;
}

/**
 * The one layout for a row of `Chip`s: centred while they fit; otherwise
 * wrapping onto more lines, or — with `scroll` — scrolling sideways from
 * the start.
 */
export default function ChipRow({ children, scroll = false, bleed = 0, style }: ChipRowProps) {
    if (scroll) {
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={[bleed ? { marginHorizontal: -bleed } : null, style]}
                // Growing to the row's width is what centres chips that fit;
                // wider content simply scrolls.
                contentContainerStyle={[styles.row, styles.scrollContent, bleed ? { paddingHorizontal: bleed } : null]}
            >
                {children}
            </ScrollView>
        );
    }
    return <View style={[styles.row, styles.wrap, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
    wrap: { flexWrap: "wrap" },
    scrollContent: { flexGrow: 1 },
});
