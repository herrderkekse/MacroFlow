// "Changes vs. saved recipe" list for an edited recipe log: colour-coded
// added / removed / changed / unchanged ingredient rows plus a +/−/~ summary.

import type { DiffRow, DiffType, RecipeSlide } from "@/src/features/share/services/importPlan";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

const ICONS: Record<DiffType, string> = {
    same: "ellipse",
    added: "add-circle",
    removed: "remove-circle",
    changed: "swap-horizontal",
};

export default function IngredientDiff({ slide, colors }: { slide: RecipeSlide; colors: ThemeColors }) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const tone = (type: DiffType): { icon: string; color: string; strike: boolean; muted: boolean } => {
        switch (type) {
            case "added":
                return { icon: ICONS.added, color: colors.success, strike: false, muted: false };
            case "removed":
                return { icon: ICONS.removed, color: colors.danger, strike: true, muted: true };
            case "changed":
                return { icon: ICONS.changed, color: colors.warning, strike: false, muted: false };
            default:
                return { icon: ICONS.same, color: colors.textTertiary, strike: false, muted: false };
        }
    };

    const { added, removed, changed } = slide.diffSummary;

    return (
        <View>
            <View style={styles.headingRow}>
                <Text style={styles.heading}>{t("share.import.changesHeading")}</Text>
                <Text style={styles.summary}>
                    +{added} −{removed} ~{changed}
                </Text>
            </View>
            <View style={styles.list}>
                {slide.diff.map((row: DiffRow, i) => {
                    const s = tone(row.type);
                    return (
                        <View key={`${row.name}-${i}`} style={styles.row}>
                            <Ionicons name={s.icon as never} size={row.type === "same" ? 7 : 15} color={s.color} />
                            <Text
                                style={[styles.name, s.strike && styles.strike, s.muted && styles.muted]}
                                numberOfLines={1}
                            >
                                {row.name}
                            </Text>
                            <Text style={[styles.qty, { color: s.color }, s.strike && styles.strike]}>
                                {row.qtyText}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        headingRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.xs,
        },
        heading: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.6,
            color: colors.textSecondary,
            textTransform: "uppercase",
        },
        summary: { fontSize: fontSize.xs, fontWeight: "700", color: colors.textTertiary },
        list: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, overflow: "hidden" },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.sm + 4,
            paddingVertical: spacing.sm + 1,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        name: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
        qty: { fontSize: fontSize.xs, fontWeight: "700" },
        strike: { textDecorationLine: "line-through" },
        muted: { color: colors.textTertiary },
    });
}
