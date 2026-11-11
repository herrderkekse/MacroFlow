import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";

interface StepperProps {
    /** The raw text of the field, so partial input like "1." survives. */
    value: string;
    onChangeText: (value: string) => void;
    step?: number;
    min?: number;
    /** Unit shown after the number (e.g. "×"). */
    suffix?: string;
    style?: StyleProp<ViewStyle>;
}

function round(value: number) {
    return String(Math.round(value * 100) / 100);
}

/** The one "number with − and +" control: portions, servings, counts. */
export default function Stepper({ value, onChangeText, step = 1, min = 0, suffix, style }: StepperProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const current = parseFloat(value.replace(",", ".")) || min;

    return (
        <View style={[styles.container, style]}>
            <IconButton
                icon="remove"
                label={t("common.decrease")}
                onPress={() => onChangeText(round(Math.max(min, current - step)))}
                disabled={current <= min}
            />
            <View style={styles.field}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    selectionColor={colors.textSecondary}
                    style={styles.input}
                />
                {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
            </View>
            <IconButton icon="add" label={t("common.increase")} onPress={() => onChangeText(round(current + step))} />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: controlHeight.md,
            paddingHorizontal: spacing.xs,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
        },
        field: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
        input: {
            minWidth: 48,
            padding: 0,
            textAlign: "center",
            fontSize: fontSize.lg,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        suffix: { fontSize: fontSize.sm, color: colors.textTertiary, marginLeft: 2 },
    });
}
