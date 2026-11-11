import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";

interface SearchBarProps extends Omit<TextInputProps, "style" | "value" | "onChangeText"> {
    value: string;
    onChangeText: (value: string) => void;
    /** Extra control at the end of the field (e.g. "search online"). */
    trailing?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** The one search field: magnifier, text, clear button. */
export default function SearchBar({ value, onChangeText, trailing, style, ...rest }: SearchBarProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={[styles.row, style]}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
                style={styles.input}
                placeholderTextColor={colors.textTertiary}
                selectionColor={colors.textSecondary}
                value={value}
                onChangeText={onChangeText}
                returnKeyType="search"
                autoCorrect={false}
                {...rest}
            />
            {value.length > 0 && (
                <Pressable onPress={() => onChangeText("")} hitSlop={10} accessibilityLabel={t("common.clear")}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
            )}
            {trailing}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: controlHeight.md,
            paddingHorizontal: spacing.sm + 4,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.borderStrong,
        },
        input: { flex: 1, fontSize: fontSize.md, color: colors.text, padding: 0 },
    });
}
