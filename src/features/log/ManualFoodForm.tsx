import FoodForm from "@/src/components/FoodForm";
import ModalHeader from "@/src/components/ModalHeader";
import type { Food } from "@/src/db/queries";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import React from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";

interface ManualFoodFormProps {
    visible: boolean;
    onClose: () => void;
    onFoodCreated: (food: Food) => void;
    initialName?: string;
}

export default function ManualFoodForm({
    visible,
    onClose,
    onFoodCreated,
    initialName,
}: ManualFoodFormProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();

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
                    initialName={initialName}
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
