import Button from "@/src/shared/atoms/Button";
import BottomSheet, { type BottomSheetRef } from "@/src/shared/components/BottomSheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RepAnalysis } from "../types";
import PlateSizeControl from "./PlateSizeControl";
import RepList from "./RepList";
import RepSummary from "./RepSummary";

// The drag handle's area (BottomSheet) and the row of figures under it.
const HANDLE_HEIGHT = 22;
const SUMMARY_HEIGHT = 56;
/** How much of the sheet shows while it is down, above the bottom safe area. */
export const REP_SHEET_PEEK = HANDLE_HEIGHT + SUMMARY_HEIGHT;
// Pulled up, it leaves the top of the video in view.
const EXPANDED_SHARE = 0.62;

interface RepSheetProps {
    analysis: RepAnalysis;
    plateDiameterM: number;
    onPlateDiameterChange: (metres: number) => void;
    /** A rep was tapped: the sheet goes down and the rep plays. */
    onRepPress: (startMs: number) => void;
    /** Back to marking the plate; null where that isn't possible. */
    onRedo: (() => void) | null;
}

/**
 * The tracked set's numbers, in a sheet over the bottom of the screen: its
 * figures while it is down, every rep (and the settings the numbers depend
 * on) when pulled or tapped up.
 */
export default function RepSheet({ analysis, plateDiameterM, onPlateDiameterChange, onRepPress, onRedo }: RepSheetProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const sheet = useRef<BottomSheetRef>(null);
    const [expanded, setExpanded] = useState(false);
    const peek = REP_SHEET_PEEK + insets.bottom;
    const snapPoints = useMemo(() => [peek, Math.max(peek + 120, Math.round(height * EXPANDED_SHARE))], [peek, height]);

    return (
        <BottomSheet ref={sheet} snapPoints={snapPoints} onSnapChange={(index) => setExpanded(index > 0)}>
            <Pressable
                style={styles.summary}
                onPress={() => sheet.current?.snapTo(expanded ? 0 : 1)}
                accessibilityRole="button"
                accessibilityLabel={t(expanded ? "barPath.hideReps" : "barPath.showReps")}
            >
                <RepSummary analysis={analysis} />
                <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={18} color={colors.textTertiary} />
            </Pressable>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
                <RepList
                    analysis={analysis}
                    onRepPress={(ms) => {
                        sheet.current?.snapTo(0);
                        onRepPress(ms);
                    }}
                />
                <PlateSizeControl diameterM={plateDiameterM} onChange={onPlateDiameterChange} />
                {onRedo && (
                    <Button
                        title={t("barPath.redo")}
                        variant="secondary"
                        icon={<Ionicons name="locate-outline" size={18} color={colors.text} />}
                        onPress={onRedo}
                    />
                )}
            </ScrollView>
        </BottomSheet>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        summary: {
            height: SUMMARY_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: screenPadding,
            paddingBottom: spacing.sm,
        },
        content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, gap: spacing.md },
    });
}
