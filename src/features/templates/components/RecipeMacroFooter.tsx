import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MacroTotals } from "../hooks/useRecipeEditor";

interface RecipeMacroFooterProps {
    perServing: MacroTotals;
    totals: MacroTotals;
    servings: number;
    canSave: boolean;
    onSave: () => void;
    onSaveAndLog: () => void;
}

/**
 * Pinned summary of what one serving contains, plus the two ways out of the
 * editor — replacing the old, ambiguous "Done" button.
 */
export default function RecipeMacroFooter({
    perServing,
    totals,
    servings,
    canSave,
    onSave,
    onSaveAndLog,
}: RecipeMacroFooterProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const macros = [
        { key: "protein", label: t("common.protein"), grams: perServing.protein, kcal: perServing.protein * 4, color: colors.protein },
        { key: "carbs", label: t("common.carbs"), grams: perServing.carbs, kcal: perServing.carbs * 4, color: colors.carbs },
        { key: "fat", label: t("common.fat"), grams: perServing.fat, kcal: perServing.fat * 9, color: colors.fat },
    ];
    const macroKcal = macros.reduce((sum, m) => sum + m.kcal, 0);

    const [naturalWidths, setNaturalWidths] = React.useState<number[]>([]);
    const recordNaturalWidth = React.useCallback((index: number, width: number) => {
        setNaturalWidths((known) => {
            if (Math.round(known[index] ?? -1) === Math.round(width)) return known;
            const next = [...known];
            next[index] = width;
            return next;
        });
    }, []);

    return (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
            <View style={styles.headline}>
                <View style={styles.calRow}>
                    <Text style={styles.calValue}>{Math.round(perServing.calories)}</Text>
                    <Text style={styles.calUnit}>{t("templates.kcalPerServing")}</Text>
                </View>
                <Text style={styles.totalLine}>
                    {canSave
                        ? t("templates.wholeRecipeTotal", { cal: Math.round(totals.calories), servings })
                        : t("templates.addIngredientsForMacros")}
                </Text>
            </View>

            <View style={styles.bar}>
                {macroKcal > 0 &&
                    macros.map((m) => (
                        <View
                            key={m.key}
                            style={{ width: `${(m.kcal / macroKcal) * 100}%`, backgroundColor: m.color }}
                        />
                    ))}
            </View>

            <View style={styles.chips}>
                {macros.map((m, index) => (
                    <View key={m.key} style={[styles.chip, { minWidth: naturalWidths[index] ?? 0 }]}>
                        <ChipContent macro={m} styles={styles} />
                    </View>
                ))}
            </View>

            {/* Off-screen copy that lays out at its natural size, so each chip
                knows how wide it wants to be. The visible chips share the row
                evenly, and only one that cannot fit — "Kohlenhydrate" in
                German — takes the width it needs from the others. */}
            <View
                style={styles.measureRow}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
            >
                {macros.map((m, index) => (
                    <View
                        key={m.key}
                        style={styles.measureChip}
                        onLayout={(e) => recordNaturalWidth(index, e.nativeEvent.layout.width)}
                    >
                        <ChipContent macro={m} styles={styles} />
                    </View>
                ))}
            </View>

            <View style={styles.actions}>
                <Button
                    title={t("templates.saveAndLog")}
                    variant="outline"
                    icon={<Ionicons name="today-outline" size={17} color={colors.primary} />}
                    onPress={onSaveAndLog}
                    disabled={!canSave}
                    style={styles.saveLogBtn}
                    textStyle={styles.saveLogBtnText}
                />
                <Button
                    title={t("templates.saveRecipe")}
                    onPress={onSave}
                    disabled={!canSave}
                    style={styles.saveBtn}
                />
            </View>
        </View>
    );
}

interface ChipContentProps {
    macro: { label: string; grams: number; color: string };
    styles: ReturnType<typeof createStyles>;
}

function ChipContent({ macro, styles }: ChipContentProps) {
    const { t } = useTranslation();
    return (
        <>
            <View style={[styles.chipDot, { backgroundColor: macro.color }]} />
            <Text style={styles.chipLabel}>{macro.label}</Text>
            <Text style={styles.chipValue}>
                {Math.round(macro.grams)} {t("common.g")}
            </Text>
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        footer: {
            backgroundColor: colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.sm,
        },
        headline: {
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: spacing.sm,
        },
        calRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs },
        calValue: { fontSize: 28, fontWeight: "800", color: colors.text },
        calUnit: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary },
        totalLine: { flex: 1, textAlign: "right", fontSize: fontSize.xs, color: colors.textTertiary },
        bar: {
            flexDirection: "row",
            height: 6,
            borderRadius: 999,
            overflow: "hidden",
            backgroundColor: colors.border,
        },
        chips: { flexDirection: "row", gap: spacing.sm },
        chip: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.xs,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.xs,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
        },
        // Laid out unconstrained and never drawn.
        measureRow: {
            position: "absolute",
            opacity: 0,
            flexDirection: "row",
        },
        measureChip: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.xs,
            borderWidth: 1,
        },
        chipDot: { width: 7, height: 7, borderRadius: 999 },
        chipLabel: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary },
        chipValue: { fontSize: fontSize.xs, fontWeight: "800", color: colors.text },
        actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
        saveLogBtn: { flex: 1, borderColor: colors.primary },
        saveLogBtnText: { fontSize: fontSize.sm, color: colors.primary },
        saveBtn: { flex: 1 },
    });
}
