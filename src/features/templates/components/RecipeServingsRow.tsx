import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

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
                <IconButton
                    icon="remove"
                    size="sm"
                    label={t("common.decrease")}
                    onPress={() => onChangeServings(servings - 1)}
                    disabled={servings <= 1}
                />
                <Text style={styles.stepperValue}>
                    {t("templates.servingCount", { count: servings })}
                </Text>
                <IconButton
                    icon="add"
                    size="sm"
                    label={t("common.increase")}
                    onPress={() => onChangeServings(servings + 1)}
                />
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
            backgroundColor: colors.background,
            paddingHorizontal: screenPadding,
            paddingBottom: spacing.sm + 4,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        labels: { flex: 1 },
        label: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
        stepper: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: borderRadius.full,
            paddingHorizontal: 2,
            minHeight: controlHeight.sm + 4,
        },
        stepperValue: {
            minWidth: 86,
            textAlign: "center",
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
    });
}
