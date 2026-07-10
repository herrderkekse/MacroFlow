import type { ExerciseTemplate } from "@/src/features/exercise/services/exerciseTemplateDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Food, Recipe } from "../services/templateDb";

interface TemplateCardProps {
    kind: "recipe" | "food" | "exercise";
    data: Recipe | Food | ExerciseTemplate;
    subtitle: string;
    onDelete: () => void;
    // Recipe-only: variant group support
    onFork?: () => void;
    variants?: Recipe[];
    variantSubtitle?: (variant: Recipe) => string;
    expanded?: boolean;
    onToggleExpand?: () => void;
    onForkVariant?: (variant: Recipe) => void;
    onDeleteVariant?: (variant: Recipe) => void;
}

export default function TemplateCard({
    kind,
    data,
    subtitle,
    onDelete,
    onFork,
    variants = [],
    variantSubtitle,
    expanded = false,
    onToggleExpand,
    onForkVariant,
    onDeleteVariant,
}: TemplateCardProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const config = {
        recipe: { icon: "book-outline" as const, color: colors.primary },
        food: { icon: "nutrition-outline" as const, color: colors.success },
        exercise: { icon: "barbell-outline" as const, color: colors.exercise },
    }[kind];

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
        <View style={styles.card}>
            <Pressable style={styles.row} onPress={handlePress}>
                <Ionicons name={config.icon} size={22} color={config.color} style={styles.cardIcon} />
                <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{data.name}</Text>
                    <Text style={styles.cardSub}>{subtitle}</Text>
                </View>
                {variants.length > 0 && onToggleExpand && (
                    <Pressable onPress={onToggleExpand} hitSlop={8} style={styles.actionIcon}>
                        <Ionicons
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={colors.textSecondary}
                        />
                    </Pressable>
                )}
                {onFork && (
                    <Pressable onPress={onFork} hitSlop={8} style={styles.actionIcon}>
                        <Ionicons name="git-branch-outline" size={20} color={colors.textSecondary} />
                    </Pressable>
                )}
                <Pressable onPress={onDelete} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
            </Pressable>

            {expanded && variants.map((variant) => (
                <View key={variant.id} style={styles.variantRow}>
                    <Pressable style={styles.variantInfo} onPress={() => openRecipe(variant.id)}>
                        <Ionicons
                            name="return-down-forward-outline"
                            size={18}
                            color={colors.textTertiary}
                            style={styles.cardIcon}
                        />
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardName} numberOfLines={1}>{variant.name}</Text>
                            {variantSubtitle && <Text style={styles.cardSub}>{variantSubtitle(variant)}</Text>}
                        </View>
                    </Pressable>
                    {onForkVariant && (
                        <Pressable onPress={() => onForkVariant(variant)} hitSlop={8} style={styles.actionIcon}>
                            <Ionicons name="git-branch-outline" size={18} color={colors.textSecondary} />
                        </Pressable>
                    )}
                    {onDeleteVariant && (
                        <Pressable onPress={() => onDeleteVariant(variant)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </Pressable>
                    )}
                </View>
            ))}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.sm,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
        },
        variantRow: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            paddingLeft: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        variantInfo: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
        },
        cardIcon: { marginRight: spacing.sm },
        actionIcon: { marginRight: spacing.md },
        cardInfo: { flex: 1, marginRight: spacing.sm },
        cardName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
        cardSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    });
}
