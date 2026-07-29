import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

interface IngredientsSectionHeaderProps {
    count: number;
    onAdd: () => void;
    onLayout: (event: LayoutChangeEvent) => void;
}

/** "Ingredients · 4" with its Add shortcut; pinned above the scrolling list. */
export default function IngredientsSectionHeader({ count, onAdd, onLayout }: IngredientsSectionHeaderProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.row} onLayout={onLayout}>
            <Text style={styles.label}>
                {t("templates.ingredients")}
                {count > 0 ? ` · ${count}` : ""}
            </Text>
            {count > 0 && (
                <Pressable onPress={onAdd} hitSlop={8} style={styles.addLink}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                    <Text style={styles.addLinkText}>{t("common.add")}</Text>
                </Pressable>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md + spacing.xs,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            backgroundColor: colors.background,
        },
        label: {
            fontSize: fontSize.xs,
            fontWeight: "700",
            letterSpacing: 0.6,
            color: colors.textSecondary,
            textTransform: "uppercase",
        },
        addLink: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
        addLinkText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },
    });
}
