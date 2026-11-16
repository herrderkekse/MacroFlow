// Progress strip of the import queue: one segment per slide plus an "X of Y"
// counter. The title and close button live in the screen header.

import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

interface Props {
    total: number;
    /** 0-based index of the active slide; equal to total on the summary. */
    index: number;
    colors: ThemeColors;
}

export default function ImportProgress({ total, index, colors }: Props) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const dots = Array.from({ length: total });

    return (
        <View style={styles.progress}>
            <View style={styles.dots}>
                {dots.map((_, i) => (
                    <View
                        key={i}
                        style={[styles.dot, i === index && styles.dotActive, i < index && styles.dotFilled]}
                    />
                ))}
            </View>
            <Text style={styles.counter}>
                {t("share.import.counter", { current: Math.min(index + 1, total), total })}
            </Text>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        progress: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: screenPadding,
            paddingBottom: spacing.sm,
        },
        dots: { flexDirection: "row", gap: 4, flex: 1 },
        dot: { flex: 1, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.border },
        dotFilled: { backgroundColor: colors.textTertiary },
        dotActive: { backgroundColor: colors.primary },
        counter: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary, fontVariant: ["tabular-nums"] },
    });
}
