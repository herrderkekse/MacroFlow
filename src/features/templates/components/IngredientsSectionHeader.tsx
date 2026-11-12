import SectionHeader from "@/src/shared/components/SectionHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, type ThemeColors } from "@/src/utils/theme";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

interface IngredientsSectionHeaderProps {
    count: number;
    onAdd: () => void;
    onLayout: (event: LayoutChangeEvent) => void;
}

/** "+ INGREDIENTS  4 items" — adds an ingredient; pinned above the scrolling list. */
export default function IngredientsSectionHeader({ count, onAdd, onLayout }: IngredientsSectionHeaderProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.row} onLayout={onLayout}>
            <SectionHeader
                title={t("templates.ingredients")}
                hint={count > 0 ? t("common.itemCount", { count }) : undefined}
                onAdd={onAdd}
                addLabel={t("templates.addIngredient")}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: { paddingHorizontal: screenPadding, backgroundColor: colors.background },
    });
}
