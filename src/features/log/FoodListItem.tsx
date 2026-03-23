import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/src/utils/theme";

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
                    {Math.round(calories)} cal
                </Text>
            </View>
            <View style={styles.macros}>
                <MacroPill label="P" value={protein} color={colors.protein} />
                <MacroPill label="C" value={carbs} color={colors.carbs} />
                <MacroPill label="F" value={fat} color={colors.fat} />
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
        <Text style={[styles.macroPill, { color }]}>
            {label}: {value.toFixed(1)}g
        </Text>
    );
}

const styles = StyleSheet.create({
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
