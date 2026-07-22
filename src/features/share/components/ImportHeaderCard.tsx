// Floating header for the import queue: title, who shared it, a close button,
// and a progress strip (one dot per slide) with an "X of Y" counter.

import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
    title: string;
    sharedBy?: string;
    total: number;
    /** 0-based index of the active slide; equal to total on the summary. */
    index: number;
    showProgress: boolean;
    onClose: () => void;
    colors: ThemeColors;
}

export default function ImportHeaderCard({ title, sharedBy, total, index, showProgress, onClose, colors }: Props) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const dots = Array.from({ length: total });

    return (
        <View style={styles.card}>
            <View style={styles.top}>
                <View style={styles.titleWrap}>
                    <Text style={styles.title}>{title}</Text>
                    {sharedBy ? (
                        <View style={styles.fromRow}>
                            <Ionicons name="link-outline" size={13} color={colors.textSecondary} />
                            <Text style={styles.from} numberOfLines={1}>
                                {t("share.import.from", { name: sharedBy })}
                            </Text>
                        </View>
                    ) : null}
                </View>
                <Pressable onPress={onClose} hitSlop={8}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
            </View>

            {showProgress && total > 1 ? (
                <View style={styles.progress}>
                    <View style={styles.dots}>
                        {dots.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === index && styles.dotActive,
                                    i < index && styles.dotFilled,
                                ]}
                            />
                        ))}
                    </View>
                    <Text style={styles.counter}>
                        {t("share.import.counter", { current: Math.min(index + 1, total), total })}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
        },
        top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
        titleWrap: { flex: 1, paddingRight: spacing.sm },
        title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
        fromRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
        from: { fontSize: fontSize.xs, color: colors.textSecondary, flexShrink: 1 },
        progress: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
        dots: { flexDirection: "row", gap: 5, flex: 1 },
        dot: { flex: 1, height: 5, borderRadius: 999, backgroundColor: colors.border },
        dotFilled: { backgroundColor: colors.primaryLight },
        dotActive: { backgroundColor: colors.primary },
        counter: { fontSize: fontSize.xs, fontWeight: "700", color: colors.textSecondary },
    });
}
