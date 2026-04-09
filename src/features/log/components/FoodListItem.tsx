import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface FoodListItemProps {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    badge?: string;
    onPress: () => void;
}

export default function FoodListItem({
    name,
    calories,
    protein,
    carbs,
    fat,
    badge,
    onPress,
}: FoodListItemProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.container,
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.top}>
                <Text style={styles.name} numberOfLines={1}>
                    {name}
                </Text>
                <Text style={styles.calories}>
                    {Math.round(calories)} {t("common.cal")}
                </Text>
            </View>
            <View style={styles.macros}>
                <MacroPill label={t("common.proteinShort")} value={protein} color={colors.protein} />
                <MacroPill label={t("common.carbsShort")} value={carbs} color={colors.carbs} />
                <MacroPill label={t("common.fatShort")} value={fat} color={colors.fat} />
                {badge && (
                    <View style={styles.badge}>
                        <Ionicons
                            name="globe-outline"
                            size={12}
                            color={colors.textTertiary}
                        />
                        <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                )}
            </View>
        </Pressable>
    );
}

function MacroPill({
    label,
    value,
    color,
}: {
    label: string;
    value: number;
    color: string;
}) {
    return (
        <Text style={{ fontSize: fontSize.xs, fontWeight: "500", color }}>
            {label}: {value.toFixed(1)}g
        </Text>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
        },
        pressed: { backgroundColor: colors.primaryLight },
        top: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.xs,
        },
        name: {
            flex: 1,
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.text,
            marginRight: spacing.sm,
        },
        calories: {
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.calories,
        },
        macros: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
        },
        macroPill: { fontSize: fontSize.xs, fontWeight: "500" },
        badge: {
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            marginLeft: "auto",
        },
        badgeText: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
        },
    });
}
