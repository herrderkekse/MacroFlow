import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

interface RecipeServingsRowProps {
    servings: number;
    onChangeServings: (value: number) => void;
    onLayout: (event: LayoutChangeEvent) => void;
}

/** "Makes N servings" — the yield the per-serving macros are divided by. */
export default function RecipeServingsRow({
    servings,
    onChangeServings,
    onLayout,
}: RecipeServingsRowProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.row} onLayout={onLayout}>
            <View style={styles.labels}>
                <Text style={styles.label}>{t("templates.makes")}</Text>
                <Text style={styles.hint}>{t("templates.macrosPerServing")}</Text>
            </View>
            <View style={styles.stepper}>
                <Pressable
                    onPress={() => onChangeServings(servings - 1)}
                    disabled={servings <= 1}
                    hitSlop={4}
                    style={[styles.stepperBtn, servings <= 1 && styles.stepperBtnDisabled]}
                >
                    <Ionicons name="remove" size={18} color={colors.primary} />
                </Pressable>
                <Text style={styles.stepperValue}>
                    {t("templates.servingCount", { count: servings })}
                </Text>
                <Pressable onPress={() => onChangeServings(servings + 1)} hitSlop={4} style={styles.stepperBtn}>
                    <Ionicons name="add" size={18} color={colors.primary} />
                </Pressable>
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        labels: { flex: 1 },
        label: {
            fontSize: fontSize.xs,
            fontWeight: "700",
            letterSpacing: 0.6,
            color: colors.textSecondary,
            textTransform: "uppercase",
        },
        hint: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            marginTop: 2,
        },
        stepper: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 999,
            padding: spacing.xs,
        },
        stepperBtn: {
            width: 34,
            height: 34,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        stepperBtnDisabled: { opacity: 0.45 },
        stepperValue: {
            minWidth: 86,
            textAlign: "center",
            fontSize: fontSize.sm,
            fontWeight: "700",
            color: colors.text,
        },
    });
}
