import { getServingUnits } from "@/src/features/templates/services/templateDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatEntryQuantity } from "@/src/utils/units";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { entryMacros } from "../helpers/logHelpers";
import type { EntryWithFood } from "./mealSectionContext";

interface RecipeIngredientRowProps {
    row: EntryWithFood;
    /** The last ingredient ends the tree line instead of running on. */
    isLast: boolean;
    onPress?: () => void;
}

/** One ingredient of a logged recipe, hanging off the recipe's tree line. */
export default function RecipeIngredientRow({ row, isLast, onPress }: RecipeIngredientRowProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const food = row.foods;
    const unit = row.entries.quantity_unit ?? "g";
    const servingGrams = food?.id ? getServingUnits(food.id).find((s) => s.name === unit)?.grams : undefined;

    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
        >
            <View style={styles.tree}>
                <View style={styles.elbow} />
                {!isLast && <View style={styles.stem} />}
            </View>
            <Text style={styles.name} numberOfLines={1}>{food?.name ?? t("log.unknownFood")}</Text>
            <Text style={styles.amount} numberOfLines={1}>
                {formatEntryQuantity(row.entries.quantity_grams, unit, servingGrams)}
            </Text>
            <Text style={styles.calories}>{Math.round(entryMacros(row).calories)}</Text>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    const line = { borderColor: colors.borderStrong, borderLeftWidth: 1 };
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 2,
            paddingLeft: spacing.md + 6,
            paddingRight: spacing.md,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        tree: { width: 16, alignSelf: "stretch" },
        elbow: {
            ...line,
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "50%",
            borderBottomWidth: 1,
            borderBottomLeftRadius: 5,
        },
        stem: { ...line, position: "absolute", left: 0, top: "50%", bottom: 0 },
        name: { flex: 1, minWidth: 0, fontSize: fontSize.sm - 1, color: colors.textSecondary, paddingVertical: spacing.sm },
        amount: { fontSize: fontSize.xs, color: colors.textTertiary },
        calories: {
            minWidth: 34,
            textAlign: "right",
            fontSize: fontSize.xs,
            fontWeight: "500",
            color: colors.textSecondary,
            fontVariant: ["tabular-nums"],
        },
    });
}
