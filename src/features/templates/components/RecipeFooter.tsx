import Button from "@/src/shared/atoms/Button";
import AddPlaceholder from "@/src/shared/components/AddPlaceholder";
import FooterBar from "@/src/shared/components/FooterBar";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { spacing } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

interface RecipeFooterProps {
    canSave: boolean;
    onSave: () => void;
    onSaveAndLog: () => void;
    onAddIngredient: () => void;
}

/**
 * Pinned at the bottom, like the workout's: "+ Add ingredient", then the two
 * ways out of the editor side by side.
 */
export default function RecipeFooter({ canSave, onSave, onSaveAndLog, onAddIngredient }: RecipeFooterProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();

    return (
        <FooterBar>
            <AddPlaceholder label={t("templates.addIngredient")} onPress={onAddIngredient} />
            <View style={styles.actions}>
                <Button
                    title={t("templates.saveAndLog")}
                    variant="outline"
                    icon={<Ionicons name="today-outline" size={17} color={colors.text} />}
                    onPress={onSaveAndLog}
                    disabled={!canSave}
                    style={styles.action}
                />
                <Button title={t("templates.saveRecipe")} onPress={onSave} disabled={!canSave} style={styles.action} />
            </View>
        </FooterBar>
    );
}

const styles = StyleSheet.create({
    actions: { flexDirection: "row", gap: spacing.sm },
    action: { flex: 1 },
});
