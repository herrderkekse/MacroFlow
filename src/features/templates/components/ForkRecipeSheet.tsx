import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import Sheet from "@/src/shared/components/Sheet";
import { spacing } from "@/src/utils/theme";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import type { ForkTarget } from "../hooks/useTemplateList";
import { getRecipeDisplayName } from "../services/recipeVariantsDb";

interface ForkRecipeSheetProps {
    target: ForkTarget | null;
    onClose: () => void;
    onSubmit: (variantName: string) => void;
}

/** Names a new variant of a recipe. */
export default function ForkRecipeSheet({ target, onClose, onSubmit }: ForkRecipeSheetProps) {
    const { t } = useTranslation();
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
        <Sheet
            visible={!!target}
            onClose={onClose}
            title={t("templates.createVariant")}
            subtitle={t("templates.forkDescription", { name: baseName })}
            footer={<Button title={t("common.create")} onPress={handleCreate} disabled={!variantName.trim()} />}
        >
            <Input
                label={t("templates.variantName")}
                placeholder={t("templates.variantNamePlaceholder")}
                value={variantName}
                onChangeText={setVariantName}
                containerStyle={styles.input}
                autoFocus
                onSubmitEditing={handleCreate}
            />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    input: { marginTop: spacing.xs, marginBottom: spacing.md },
});
