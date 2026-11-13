import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

/** What stands above a plot: the whole range at rest, one column or point while it is selected. */
export interface Headline {
    caption: string;
    value?: string;
    unit?: string;
    /** Quieter addition after the value. */
    note?: string;
    /** Right-hand side of the value row: what the plot's dashed line stands for, e.g. the goal. */
    aside?: string;
    tiles?: { color: string; label: string; value: string }[];
}

interface ChartHeadlineProps {
    headline: Headline;
}

/**
 * What the plot below is showing, in figures: the range's average at rest,
 * the selected day while one is touched. Keeps its height between the two.
 */
export default function ChartHeadline({ headline }: ChartHeadlineProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { caption, value, unit, note, aside, tiles } = headline;

    return (
        <View>
            <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
            {value != null && (
                <View style={styles.valueRow}>
                    <Text style={styles.value} numberOfLines={1}>
                        {value}
                        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
                        {note ? <Text style={styles.unit}>{"  ·  "}{note}</Text> : null}
                    </Text>
                    {aside ? (
                        <>
                            <View style={styles.dashes}>
                                <View style={styles.dash} />
                                <View style={styles.dash} />
                                <View style={styles.dash} />
                            </View>
                            <Text style={styles.aside} numberOfLines={1}>{aside}</Text>
                        </>
                    ) : null}
                </View>
            )}
            {tiles && (
                <View style={styles.tiles}>
                    {tiles.map((tile) => (
                        <View key={tile.label} style={styles.tile}>
                            <View style={styles.tileLabel}>
                                <View style={[styles.dot, { backgroundColor: tile.color }]} />
                                <Text style={styles.tileText} numberOfLines={1}>{tile.label}</Text>
                            </View>
                            <Text style={styles.tileValue} numberOfLines={1}>{tile.value}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        caption: { fontSize: fontSize.xs, color: colors.textSecondary },
        valueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
        value: { flex: 1, fontSize: fontSize.xl, fontWeight: "600", letterSpacing: -0.5, color: colors.text },
        unit: { fontSize: fontSize.xs, fontWeight: "400", letterSpacing: 0, color: colors.textTertiary },
        // The goal line's key: the same dashes as in the plot, at mid-height of the text beside them.
        dashes: { flexDirection: "row", gap: 3, alignSelf: "flex-end", marginBottom: 11 },
        dash: { width: 4, height: 1.25, backgroundColor: colors.textSecondary },
        aside: { fontSize: fontSize.xs, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
        tiles: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm + 4 },
        tile: { flex: 1 },
        tileLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
        dot: { width: 7, height: 7, borderRadius: borderRadius.full },
        tileText: { flexShrink: 1, fontSize: fontSize.xs, color: colors.textSecondary },
        tileValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginTop: 1, fontVariant: ["tabular-nums"] },
    });
}
