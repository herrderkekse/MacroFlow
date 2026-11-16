import Button from "@/src/shared/atoms/Button";
import Sheet from "@/src/shared/components/Sheet";
import Stepper from "@/src/shared/components/Stepper";
import { spacing } from "@/src/utils/theme";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";

interface PortionSheetProps {
    visible: boolean;
    /** Name of the logged recipe, shown under the title. */
    recipeName?: string;
    value: string;
    onChangeValue: (value: string) => void;
    onSave: () => void;
    /** Removes the whole logged recipe. */
    onDelete?: () => void;
    onClose: () => void;
}

/** Scales a logged recipe to a different number of portions, or deletes it. */
export default function PortionSheet({ visible, recipeName, value, onChangeValue, onSave, onDelete, onClose }: PortionSheetProps) {
    const { t } = useTranslation();
    const isValid = (parseFloat(value.replace(",", ".")) || 0) > 0;

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t("log.adjustPortions")}
            subtitle={recipeName}
            footer={
                <>
                    <Button title={t("common.save")} onPress={onSave} disabled={!isValid} />
                    {onDelete && <Button title={t("log.deleteEntry")} variant="danger" onPress={onDelete} />}
                </>
            }
        >
            <Stepper value={value} onChangeText={onChangeValue} step={1} min={0.25} style={styles.stepper} />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    stepper: { marginBottom: spacing.md },
});
