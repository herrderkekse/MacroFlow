import type { ExerciseTemplate } from "@/src/features/exercise/services/exerciseTemplateDb";
import MacroNumbers from "@/src/shared/components/MacroNumbers";
import TreeBranch from "@/src/shared/components/TreeBranch";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TemplateMacros } from "../hooks/useTemplateList";
import type { Food, Recipe } from "../services/templateDb";

interface TemplateCardProps {
    kind: "recipe" | "food" | "exercise";
    data: Recipe | Food | ExerciseTemplate;
    /** "2 servings · 3 ingredients", "Food · per 100 g", "Weight · Chest". */
    subtitle: string;
    /** Calories and macros to show (per serving / per 100 g); none for exercises. */
    macros?: TemplateMacros | null;
    /** Where the row sits in the list's single card, for its rounded ends. */
    isFirst: boolean;
    isLast: boolean;
    /** Opens the item's menu of secondary actions (variant, delete); bound to a long press. */
    onMenu: () => void;
    // Recipe-only: variant group support
    variants?: Recipe[];
    variantSubtitle?: (variant: Recipe) => string;
    variantMacros?: (variant: Recipe) => TemplateMacros | null;
    expanded?: boolean;
    onToggleExpand?: () => void;
    onMenuVariant?: (variant: Recipe) => void;
}

const ROW_PAD_V = spacing.md - 2;
const ROW_PAD_H = spacing.md - 1;
const ROW_GAP = spacing.sm + 4;

const KIND_ICON = {
    recipe: "book-outline",
    food: "nutrition-outline",
    exercise: "barbell-outline",
} as const;

function openTemplate(kind: TemplateCardProps["kind"], id: number) {
    const pathname = kind === "recipe" ? "/templates/edit" : kind === "food" ? "/templates/food-edit" : "/templates/exercise-edit";
    const key = kind === "recipe" ? "recipeId" : kind === "food" ? "foodId" : "exerciseId";
    router.push({ pathname, params: { [key]: String(id) } } as unknown as Href);
}

/**
 * One library item, as a row of the list's single card: a kind badge, the
 * name over its details, and its calories and macros on the right. A
 * recipe's chevron opens its variants, hanging off a tree line. Tapping opens the
 * editor; a long press opens the menu (create a variant, delete).
 */
export default function TemplateCard({
    kind,
    data,
    subtitle,
    macros,
    isFirst,
    isLast,
    onMenu,
    variants = [],
    variantSubtitle,
    variantMacros,
    expanded = false,
    onToggleExpand,
    onMenuVariant,
}: TemplateCardProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const menuAction = [{ name: "longpress", label: t("common.moreActions") }];
    const hasVariants = variants.length > 0 && !!onToggleExpand;

    return (
        <View style={[styles.card, isFirst && styles.first, isLast && styles.last, !isFirst && styles.divider]}>
            <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => openTemplate(kind, data.id)}
                onLongPress={onMenu}
                accessibilityRole="button"
                accessibilityActions={menuAction}
                onAccessibilityAction={onMenu}
            >
                <View style={styles.badge}>
                    <Ionicons name={KIND_ICON[kind]} size={16} color={colors.textSecondary} />
                </View>
                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{data.name}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                </View>
                {hasVariants ? (
                    // The whole right-hand column toggles, from the row's top
                    // to its bottom and out to the card's edge — the chevron
                    // alone is too small to hit.
                    <Pressable
                        onPress={onToggleExpand}
                        style={({ pressed }) => [styles.side, styles.sideTarget, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={t("templates.showVariants")}
                        accessibilityState={{ expanded }}
                    >
                        {macros && <MacroNumbers {...macros} />}
                        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.textTertiary} />
                    </Pressable>
                ) : macros ? (
                    <View style={styles.side}>
                        <MacroNumbers {...macros} />
                    </View>
                ) : null}
            </Pressable>

            {expanded && variants.map((variant, index) => {
                const vm = variantMacros?.(variant);
                return (
                    <Pressable
                        key={variant.id}
                        style={({ pressed }) => [styles.variantRow, pressed && styles.pressed]}
                        onPress={() => openTemplate("recipe", variant.id)}
                        onLongPress={onMenuVariant ? () => onMenuVariant(variant) : undefined}
                        accessibilityRole="button"
                        accessibilityActions={onMenuVariant ? menuAction : undefined}
                        onAccessibilityAction={onMenuVariant ? () => onMenuVariant(variant) : undefined}
                    >
                        <TreeBranch isLast={index === variants.length - 1} />
                        <View style={styles.variantInfo}>
                            <Text style={styles.variantName} numberOfLines={1}>{variant.name}</Text>
                            {variantSubtitle && (
                                <Text style={styles.variantSubtitle} numberOfLines={1}>{variantSubtitle(variant)}</Text>
                            )}
                        </View>
                        {vm && <Text style={styles.variantCal}>{Math.round(vm.calories)}</Text>}
                    </Pressable>
                );
            })}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        // Consecutive rows join into one card: sides on every row, the ends
        // rounded on the first and last.
        card: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            overflow: "hidden",
        },
        first: { borderTopWidth: 1, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg },
        last: { borderBottomWidth: 1, borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: borderRadius.lg },
        divider: { borderTopWidth: StyleSheet.hairlineWidth },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: ROW_GAP,
            paddingVertical: ROW_PAD_V,
            paddingHorizontal: ROW_PAD_H,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        badge: {
            width: 34,
            height: 34,
            borderRadius: borderRadius.sm + 2,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },
        info: { flex: 1, minWidth: 0 },
        name: { fontSize: fontSize.md - 1, fontWeight: "600", color: colors.text },
        subtitle: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 3 },
        // Top-aligned with the name, as on the log's entries; the chevron under the figures.
        side: { alignSelf: "flex-start", alignItems: "flex-end", gap: 4, marginTop: 2 },
        // Cancels the row's padding (and the gap before it) so the target
        // reaches the row's edges, then pads the content back into place.
        sideTarget: {
            alignSelf: "stretch",
            marginTop: -(ROW_PAD_V - 2),
            marginBottom: -ROW_PAD_V,
            marginRight: -ROW_PAD_H,
            marginLeft: -ROW_GAP,
            paddingTop: ROW_PAD_V + 2,
            paddingBottom: ROW_PAD_V,
            paddingRight: ROW_PAD_H,
            paddingLeft: ROW_GAP + spacing.sm,
        },
        // The tree line drops from the middle of the badge above.
        variantRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 2,
            paddingLeft: ROW_PAD_H + 17,
            paddingRight: ROW_PAD_H,
        },
        variantInfo: { flex: 1, minWidth: 0, paddingVertical: spacing.sm + 1 },
        variantName: { fontSize: fontSize.sm - 0.5, fontWeight: "600", color: colors.text },
        variantSubtitle: { fontSize: fontSize.xs - 0.5, color: colors.textTertiary, marginTop: 2 },
        variantCal: { fontSize: fontSize.sm - 1.5, fontWeight: "600", color: colors.textSecondary, fontVariant: ["tabular-nums"] },
    });
}
