import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Line box of the title, used to centre the icons against its first line. */
const TITLE_LINE_HEIGHT = 32;

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
 * The screen's only header: the recipe title doubles as the heading and as
 * the field that edits it, with the actions on the far side of the same row.
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
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            {baseName != null && (
                <Text style={styles.variantOf}>{t("templates.variantOf", { name: baseName })}</Text>
            )}
            <View style={styles.row}>
                {/* The pencil, and the whole title being tappable, are what
                    mark it as editable — on its own it reads as a heading. */}
                <Pressable style={styles.titleArea} onPress={() => inputRef.current?.focus()}>
                    <Ionicons name="pencil" size={16} color={colors.textTertiary} style={styles.pencil} />
                    <TextInput
                        ref={inputRef}
                        style={styles.nameInput}
                        value={name}
                        onChangeText={onChangeName}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        returnKeyType="done"
                        // Return finishes the title instead of adding a line to it.
                        submitBehavior="blurAndSubmit"
                    />
                </Pressable>

                <View style={styles.actions}>
                    {onShare && (
                        <Pressable onPress={onShare} hitSlop={8} style={shareDimmed && styles.dimmed}>
                            <Ionicons name="share-outline" size={22} color={colors.text} />
                        </Pressable>
                    )}
                    <Pressable onPress={onClose} hitSlop={8}>
                        <Ionicons name="close" size={26} color={colors.textSecondary} />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        header: {
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
        },
        variantOf: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginBottom: spacing.xs,
        },
        row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
        titleArea: {
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm,
        },
        pencil: { marginTop: (TITLE_LINE_HEIGHT - 16) / 2 },
        nameInput: {
            flex: 1,
            fontSize: 26,
            lineHeight: TITLE_LINE_HEIGHT,
            fontWeight: "700",
            color: colors.text,
            padding: 0,
            // Android pads glyphs by default, which throws the row alignment off.
            includeFontPadding: false,
        },
        actions: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            height: TITLE_LINE_HEIGHT,
        },
        dimmed: { opacity: 0.4 },
    });
}
