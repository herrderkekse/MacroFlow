// Shared "when to log" controls: a tappable date row and a 4-up meal picker,
// reused by recipe slides and expanded food rows.

import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function DateRow({
    label,
    onPress,
    colors,
}: {
    label: string;
    onPress: () => void;
    colors: ThemeColors;
}) {
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <Pressable style={styles.dateRow} onPress={onPress}>
            <View style={styles.dateLeft}>
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <Text style={styles.dateText}>{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
    );
}

export function MealPicker({
    selected,
    onSelect,
    colors,
}: {
    selected: MealType;
    onSelect: (meal: MealType) => void;
    colors: ThemeColors;
}) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.mealRow}>
            {MEAL_TYPES.map((meal) => {
                const on = meal.key === selected;
                return (
                    <Pressable
                        key={meal.key}
                        style={[styles.meal, on && styles.mealOn]}
                        onPress={() => onSelect(meal.key)}
                    >
                        <Ionicons
                            name={meal.icon as never}
                            size={17}
                            color={on ? "#fff" : colors.textSecondary}
                        />
                        <Text style={[styles.mealText, on && styles.mealTextOn]}>{t(`meal.${meal.key}`)}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        dateRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.background,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
        },
        dateLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        dateText: { fontSize: fontSize.md, color: colors.text, fontWeight: "600" },
        mealRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
        meal: {
            flex: 1,
            alignItems: "center",
            gap: 4,
            paddingVertical: spacing.sm,
            paddingHorizontal: 2,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        mealOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        mealText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
        mealTextOn: { color: "#fff", fontWeight: "700" },
    });
}
