import Sheet from "@/src/shared/components/Sheet";
import React from "react";
import { useTranslation } from "react-i18next";
import { type Food } from "../services/templateDb";
import FoodForm from "./FoodForm";

interface CreateFoodSheetProps {
    visible: boolean;
    onClose: () => void;
    onFoodCreated: (food: Food) => void;
    initialName?: string;
    /** Pre-fill the barcode field, e.g. from a scanned OFF product we could not import. */
    initialBarcode?: string;
    /** Explains why the user landed here, e.g. an OFF product without nutrition facts. */
    notice?: string | null;
}

/** Creates a food without leaving the recipe being edited. */
export default function CreateFoodSheet({
    visible,
    onClose,
    onFoodCreated,
    initialName,
    initialBarcode,
    notice,
}: CreateFoodSheetProps) {
    const { t } = useTranslation();

    // `FoodForm` only reads the initial values on mount, so each opening gets a
    // fresh one — otherwise the fields keep whatever the previous visit left.
    const [formKey, setFormKey] = React.useState(0);
    const [prevVisible, setPrevVisible] = React.useState(visible);
    if (visible !== prevVisible) {
        setPrevVisible(visible);
        if (visible) setFormKey((key) => key + 1);
    }

    return (
        <Sheet visible={visible} onClose={onClose} title={t("log.createNewFood")} tall scrollable={false} padded={false}>
            <FoodForm
                key={formKey}
                initialName={initialName}
                initialBarcode={initialBarcode}
                notice={notice}
                submitLabel={t("log.createFood")}
                onSaved={(food) => onFoodCreated(food)}
                inSheet
            />
        </Sheet>
    );
}
