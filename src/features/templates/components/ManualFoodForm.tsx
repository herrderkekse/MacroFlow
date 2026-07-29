import ModalHeader from "@/src/shared/atoms/ModalHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
} from "react-native";
import { type Food } from "../services/templateDb";
import FoodForm from "./FoodForm";

interface ManualFoodFormProps {
    visible: boolean;
    onClose: () => void;
    onFoodCreated: (food: Food) => void;
    initialName?: string;
    /** Pre-fill the barcode field, e.g. from a scanned OFF product we could not import. */
    initialBarcode?: string;
    /** Explains why the user landed here, e.g. an OFF product without nutrition facts. */
    notice?: string | null;
}

export default function ManualFoodForm({
    visible,
    onClose,
    onFoodCreated,
    initialName,
    initialBarcode,
    notice,
}: ManualFoodFormProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();

    // `FoodForm` only reads the initial values on mount, so each opening gets a
    // fresh one — otherwise the fields keep whatever the previous visit left.
    const [formKey, setFormKey] = React.useState(0);
    const [prevVisible, setPrevVisible] = React.useState(visible);
    if (visible !== prevVisible) {
        setPrevVisible(visible);
        if (visible) setFormKey((key) => key + 1);
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={[styles.flex, { backgroundColor: colors.background }]}
            >
                <ModalHeader title={t("log.createNewFood")} onClose={onClose} />
                <FoodForm
                    key={formKey}
                    initialName={initialName}
                    initialBarcode={initialBarcode}
                    notice={notice}
                    submitLabel={t("log.createFood")}
                    onSaved={(food) => onFoodCreated(food)}
                />
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});
