import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import ModalHeader from "@/src/shared/atoms/ModalHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
} from "react-native";
import type { ForkTarget } from "../hooks/useTemplateList";
import { getRecipeDisplayName } from "../services/recipeVariantsDb";

interface ForkRecipeModalProps {
    target: ForkTarget | null;
    onClose: () => void;
    onSubmit: (variantName: string) => void;
}

export default function ForkRecipeModal({ target, onClose, onSubmit }: ForkRecipeModalProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [variantName, setVariantName] = useState("");

    // Reset the field whenever the modal is opened for a different recipe.
    const [prevTarget, setPrevTarget] = useState(target);
    if (target !== prevTarget) {
        setPrevTarget(target);
        setVariantName("");
    }

    function handleCreate() {
        if (!variantName.trim()) return;
        onSubmit(variantName.trim());
    }

    const baseName = target ? getRecipeDisplayName(target.recipe).name : "";

    return (
        <Modal
            visible={!!target}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex}
            >
                <ModalHeader title={t("templates.createVariant")} onClose={onClose} />

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.description}>
                        {t("templates.forkDescription", { name: baseName })}
                    </Text>

                    <Input
                        label={t("templates.variantName")}
                        placeholder={t("templates.variantNamePlaceholder")}
                        value={variantName}
                        onChangeText={setVariantName}
                        containerStyle={styles.input}
                    />

                    <Button
                        title={t("common.create")}
                        onPress={handleCreate}
                        disabled={!variantName.trim()}
                        style={styles.createButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg },
        description: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        input: { marginTop: spacing.sm },
        createButton: { marginTop: spacing.lg },
    });
}
