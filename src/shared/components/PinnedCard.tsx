import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PinnedCardProps {
    /** Edge to edge along the top, above the summary (e.g. which of several pages shows). */
    summaryHeader?: React.ReactNode;
    /** The always-visible row: the one figure the screen is about. */
    summary: React.ReactNode;
    /** Edge to edge under the summary (a progress or macro bar); doubles as the divider. */
    summaryFooter?: React.ReactNode;
    /** Opened under the summary by tapping it; without details the card does not toggle. */
    details?: React.ReactNode;
    /** Label for screen readers on the toggle (what the details are). */
    detailsLabel?: string;
    /**
     * A button in the chevron's place while there are no details, so a card
     * whose details come and go keeps its buttons where they were.
     */
    accessory?: React.ReactNode;
}

/**
 * A pushed screen's status card, pinned between the header and the
 * scrolling content (the recipe's macros, the workout's rest timer). It is
 * the same card as a tab root's `CollapsibleHeader`, but it stays put: its
 * details open and close with a tap rather than with the scroll.
 */
export default function PinnedCard({ summaryHeader, summary, summaryFooter, details, detailsLabel, accessory }: PinnedCardProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const hasDetails = details != null && details !== false;

    function toggle() {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((v) => !v);
    }

    return (
        <View style={styles.wrap}>
            <View style={styles.card}>
                {summaryHeader}
                <Pressable
                    onPress={hasDetails ? toggle : undefined}
                    disabled={!hasDetails}
                    style={styles.summaryRow}
                    accessibilityRole={hasDetails ? "button" : undefined}
                    accessibilityLabel={hasDetails ? (detailsLabel ?? t("common.toggleDetails")) : undefined}
                    accessibilityState={hasDetails ? { expanded: open } : undefined}
                >
                    <View style={styles.summaryBody}>{summary}</View>
                    {hasDetails ? (
                        <View style={styles.chevron}>
                            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} />
                        </View>
                    ) : accessory ? (
                        <View style={styles.chevron}>{accessory}</View>
                    ) : null}
                </Pressable>
                {summaryFooter}
                {hasDetails && open && (
                    <View style={[styles.details, !!summaryFooter && styles.detailsNoDivider]}>{details}</View>
                )}
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        wrap: { paddingHorizontal: screenPadding, paddingTop: spacing.xs, paddingBottom: spacing.sm + 4 },
        // Same card as CollapsibleHeader's.
        card: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
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
        summaryBody: { flex: 1, paddingVertical: spacing.sm + 2, paddingRight: spacing.sm },
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
