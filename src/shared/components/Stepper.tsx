import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle,
} from "react-native";

interface StepperProps {
    /** The raw text of the field, so partial input like "1." survives. */
    value: string;
    onChangeText: (value: string) => void;
    step?: number;
    min?: number;
    max?: number;
    /** Reads the number out of the field's text; defaults to a decimal number. */
    parse?: (value: string) => number;
    /** Writes a stepped number back as field text; defaults to two decimals at most. */
    format?: (value: number) => string;
    keyboardType?: KeyboardTypeOptions;
    /** Tints the number while the text is not a value the field accepts. */
    invalid?: boolean;
    onBlur?: () => void;
    /** Unit shown after the number (e.g. "×"). */
    suffix?: string;
    style?: StyleProp<ViewStyle>;
}

function round(value: number) {
    return String(Math.round(value * 100) / 100);
}

function parseDecimal(value: string) {
    return parseFloat(value.replace(",", "."));
}

// Values off the step grid (1.5 with a step of 1) snap to the next grid line
// rather than staying off it (2, not 2.5). The epsilon absorbs float error.
const EPSILON = 1e-9;
function stepUp(current: number, step: number) {
    return (Math.floor(current / step + EPSILON) + 1) * step;
}
function stepDown(current: number, step: number) {
    return (Math.ceil(current / step - EPSILON) - 1) * step;
}

/** The one "number with − and +" control: portions, servings, counts. */
export default function Stepper({
    value, onChangeText, step = 1, min = 0, max = Infinity, parse = parseDecimal, format = round,
    keyboardType = "decimal-pad", invalid, onBlur, suffix, style,
}: StepperProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const current = parse(value) || min;
    const inputRef = useRef<TextInput>(null);

    return (
        <View style={[styles.container, style]}>
            <IconButton
                icon="remove"
                label={t("common.decrease")}
                onPress={() => onChangeText(format(Math.min(max, Math.max(min, stepDown(current, step)))))}
                disabled={current <= min}
            />
            {/* The whole space between the buttons focuses the field, not just the digits. */}
            <Pressable style={styles.field} onPress={() => inputRef.current?.focus()} accessible={false}>
                <TextInput
                    ref={inputRef}
                    value={value}
                    onChangeText={onChangeText}
                    onBlur={onBlur}
                    keyboardType={keyboardType}
                    selectTextOnFocus
                    selectionColor={colors.textSecondary}
                    style={[styles.input, invalid && { color: colors.danger }]}
                />
                {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
            </Pressable>
            <IconButton
                icon="add"
                label={t("common.increase")}
                onPress={() => onChangeText(format(Math.max(min, Math.min(max, stepUp(current, step)))))}
                disabled={current >= max}
            />
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
        field: { flex: 1, alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "center" },
        input: {
            alignSelf: "stretch",
            minWidth: 96,
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
