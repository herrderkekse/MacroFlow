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
}

export default function TemplateCard({ kind, data, subtitle, onDelete }: TemplateCardProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const config = {
        recipe: { icon: "book-outline" as const, color: colors.primary },
        food: { icon: "nutrition-outline" as const, color: colors.success },
        exercise: { icon: "barbell-outline" as const, color: colors.exercise },
    }[kind];

    function handlePress() {
        if (kind === "recipe") {
            router.push({ pathname: "/templates/edit", params: { recipeId: String(data.id) } } as unknown as Href);
        } else if (kind === "food") {
            router.push({ pathname: "/templates/food-edit", params: { foodId: String(data.id) } } as unknown as Href);
        }
    }

    const Wrapper = kind === "exercise" ? View : Pressable;

    return (
        <Wrapper style={styles.card} {...(kind !== "exercise" && { onPress: handlePress })}>
            <Ionicons name={config.icon} size={22} color={config.color} style={styles.cardIcon} />
            <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{data.name}</Text>
                <Text style={styles.cardSub}>{subtitle}</Text>
            </View>
            <Pressable onPress={onDelete} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
        </Wrapper>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
        },
        cardIcon: { marginRight: spacing.sm },
        cardInfo: { flex: 1, marginRight: spacing.sm },
        cardName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
        cardSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    });
}
