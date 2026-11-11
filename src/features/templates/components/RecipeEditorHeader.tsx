import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Line box of the title, used to centre the icons against its first line. */
const TITLE_LINE_HEIGHT = 34;

interface RecipeEditorHeaderProps {
    name: string;
    onChangeName: (value: string) => void;
    placeholder: string;
    /** Set when editing a variant, whose own name is only the specification. */
    baseName?: string | null;
    /** Omitted for a recipe that has never been saved, which cannot be shared. */
    onShare?: () => void;
    shareDimmed?: boolean;
    onClose: () => void;
}

/**
 * The screen's only header: the standard bar (close, share), with the recipe
 * title below it doubling as the heading and as the field that edits it.
 */
export default function RecipeEditorHeader({
    name,
    onChangeName,
    placeholder,
    baseName,
    onShare,
    shareDimmed,
    onClose,
}: RecipeEditorHeaderProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const inputRef = useRef<TextInput>(null);

    return (
        <View style={[styles.header, { paddingTop: insets.top }]}>
            {/* Same bar as every other pushed screen: way out on the left,
                actions on the right. */}
            <View style={styles.bar}>
                <IconButton icon="close" label={t("common.close")} onPress={onClose} />
                <Text style={styles.barTitle} numberOfLines={1}>
                    {baseName != null ? t("templates.variantOf", { name: baseName }) : t("templates.recipeEditorTitle")}
                </Text>
                {onShare && (
                    <IconButton
                        icon="share-outline"
                        label={t("common.share")}
                        onPress={onShare}
                        color={shareDimmed ? colors.textTertiary : undefined}
                    />
                )}
            </View>

            {/* The pencil, and the whole title being tappable, are what mark
                it as editable — on its own it reads as a heading. */}
            <Pressable style={styles.titleArea} onPress={() => inputRef.current?.focus()}>
                <TextInput
                    ref={inputRef}
                    style={styles.nameInput}
                    value={name}
                    onChangeText={onChangeName}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textTertiary}
                    selectionColor={colors.textSecondary}
                    multiline
                    returnKeyType="done"
                    // Return finishes the title instead of adding a line to it.
                    submitBehavior="blurAndSubmit"
                />
                <Ionicons name="pencil" size={16} color={colors.textTertiary} style={styles.pencil} />
            </Pressable>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        header: { backgroundColor: colors.background },
        bar: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 56,
            paddingHorizontal: screenPadding - spacing.sm,
            gap: spacing.xs,
        },
        barTitle: { flex: 1, fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
        titleArea: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm,
            paddingHorizontal: screenPadding,
            paddingBottom: spacing.sm + 4,
        },
        pencil: { marginTop: (TITLE_LINE_HEIGHT - 16) / 2 },
        nameInput: {
            flex: 1,
            fontSize: fontSize.xxl,
            lineHeight: TITLE_LINE_HEIGHT,
            fontWeight: "700",
            letterSpacing: -0.6,
            color: colors.text,
            padding: 0,
            // Android pads glyphs by default, which throws the row alignment off.
            includeFontPadding: false,
        },
    });
}
