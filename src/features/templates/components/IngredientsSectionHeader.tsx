import Button from "@/src/shared/atoms/Button";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

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
            <SectionLabel
                style={styles.label}
                right={
                    count > 0 ? (
                        <Button
                            title={t("common.add")}
                            variant="ghost"
                            size="sm"
                            icon={<Ionicons name="add" size={16} color={colors.text} />}
                            onPress={onAdd}
                            style={styles.addButton}
                        />
                    ) : undefined
                }
            >
                {`${t("templates.ingredients")}${count > 0 ? ` · ${count}` : ""}`}
            </SectionLabel>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { paddingHorizontal: screenPadding, backgroundColor: colors.background },
        label: { marginTop: spacing.sm, marginBottom: spacing.xs, minHeight: 36 },
        addButton: { marginRight: -spacing.sm },
    });
}
