import type { ExerciseTemplate } from "@/src/features/exercise/services/exerciseTemplateDb";
import Card from "@/src/shared/atoms/Card";
import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Food, Recipe } from "../services/templateDb";

interface TemplateCardProps {
    kind: "recipe" | "food" | "exercise";
    data: Recipe | Food | ExerciseTemplate;
    subtitle: string;
    /** Opens the item's menu of secondary actions (variant, delete). */
    onMenu: () => void;
    // Recipe-only: variant group support
    variants?: Recipe[];
    variantSubtitle?: (variant: Recipe) => string;
    expanded?: boolean;
    onToggleExpand?: () => void;
    onMenuVariant?: (variant: Recipe) => void;
}

const KIND_ICON = {
    recipe: "book-outline",
    food: "nutrition-outline",
    exercise: "barbell-outline",
} as const;

/**
 * One library item. Tapping opens its editor; everything else (create a
 * variant, delete) lives behind the "more" button so the list stays calm.
 */
export default function TemplateCard({
    kind,
    data,
    subtitle,
    onMenu,
    variants = [],
    variantSubtitle,
    expanded = false,
    onToggleExpand,
    onMenuVariant,
}: TemplateCardProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    function openRecipe(id: number) {
        router.push({ pathname: "/templates/edit", params: { recipeId: String(id) } } as unknown as Href);
    }

    function handlePress() {
        if (kind === "recipe") {
            openRecipe(data.id);
        } else if (kind === "food") {
            router.push({ pathname: "/templates/food-edit", params: { foodId: String(data.id) } } as unknown as Href);
        } else {
            router.push({ pathname: "/templates/exercise-edit", params: { exerciseId: String(data.id) } } as unknown as Href);
        }
    }

    return (
        <Card padded={false} style={styles.card}>
            <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={handlePress}
                accessibilityRole="button"
            >
                <View style={styles.iconTile}>
                    <Ionicons name={KIND_ICON[kind]} size={18} color={colors.text} />
                </View>
                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{data.name}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                </View>
                {variants.length > 0 && onToggleExpand && (
                    <IconButton
                        icon={expanded ? "chevron-up" : "chevron-down"}
                        size="sm"
                        label={t("templates.showVariants")}
                        onPress={onToggleExpand}
                    />
                )}
                <IconButton icon="ellipsis-horizontal" size="sm" label={t("common.moreActions")} onPress={onMenu} />
            </Pressable>

            {expanded && variants.map((variant) => (
                <Pressable
                    key={variant.id}
                    style={({ pressed }) => [styles.row, styles.variantRow, pressed && styles.pressed]}
                    onPress={() => openRecipe(variant.id)}
                    accessibilityRole="button"
                >
                    <View style={styles.variantMarker}>
                        <Ionicons name="return-down-forward-outline" size={16} color={colors.textTertiary} />
                    </View>
                    <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={1}>{variant.name}</Text>
                        {variantSubtitle && (
                            <Text style={styles.subtitle} numberOfLines={1}>{variantSubtitle(variant)}</Text>
                        )}
                    </View>
                    {onMenuVariant && (
                        <IconButton
                            icon="ellipsis-horizontal"
                            size="sm"
                            label={t("common.moreActions")}
                            onPress={() => onMenuVariant(variant)}
                        />
                    )}
                </Pressable>
            ))}
        </Card>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: { marginBottom: spacing.sm },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 4,
            minHeight: 64,
            paddingLeft: spacing.md,
            paddingRight: spacing.sm,
            paddingVertical: spacing.sm,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        iconTile: {
            width: 36,
            height: 36,
            borderRadius: borderRadius.sm + 2,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
        },
        info: { flex: 1 },
        name: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
        subtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
        variantRow: {
            minHeight: 56,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        variantMarker: { width: 36, alignItems: "center" },
    });
}
