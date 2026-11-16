import { addFood, type Food } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import Input from "@/src/shared/atoms/Input";
import Notice from "@/src/shared/atoms/Notice";
import Sheet from "@/src/shared/components/Sheet";
import UnitPicker from "@/src/shared/components/UnitPicker";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { spacing } from "@/src/utils/theme";
import { unitsForSystem, type FoodUnit } from "@/src/utils/units";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

interface CreateFoodSheetProps {
    visible: boolean;
    onClose: () => void;
    onFoodCreated: (food: Food) => void;
    initialName?: string;
    /** Pre-fill the barcode field (e.g. after a barcode scan found no matching product) */
    initialBarcode?: string;
    /** Explains why the user landed here, e.g. an OFF product without nutrition facts. */
    notice?: string | null;
}

/** Creates a food on the spot while logging, then hands it back to be logged. */
export default function CreateFoodSheet({
    visible,
    onClose,
    onFoodCreated,
    initialName,
    initialBarcode,
    notice,
}: CreateFoodSheetProps) {
    const { t } = useTranslation();
    const unitSystem = useAppStore((s) => s.unitSystem);

    const [name, setName] = useState(initialName ?? "");
    const [calories, setCalories] = useState("");
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");
    const [defaultUnit, setDefaultUnit] = useState<FoodUnit>("g");
    const [barcode, setBarcode] = useState(initialBarcode ?? "");

    // Re-sync the pre-filled fields with the latest scan or selection whenever
    // the modal opens; they are only initial values for the state above.
    const [prevVisible, setPrevVisible] = useState(visible);
    if (visible !== prevVisible) {
        setPrevVisible(visible);
        if (visible) {
            setName(initialName ?? "");
            setBarcode(initialBarcode ?? "");
        }
    }

    function handleSave() {
        if (!name.trim()) return;
        const food = addFood({
            name: name.trim(),
            calories_per_100g: parseFloat(calories) || 0,
            protein_per_100g: parseFloat(protein) || 0,
            carbs_per_100g: parseFloat(carbs) || 0,
            fat_per_100g: parseFloat(fat) || 0,
            source: "manual",
            default_unit: defaultUnit,
            barcode: barcode.trim() || undefined,
        });
        setName("");
        setCalories("");
        setProtein("");
        setCarbs("");
        setFat("");
        setDefaultUnit("g");
        setBarcode("");
        onFoodCreated(food);
    }

    const unitOptions = unitsForSystem(unitSystem);

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t("log.createNewFood")}
            footer={<Button title={t("log.createFood")} onPress={handleSave} disabled={!name.trim()} />}
        >
            {notice && <Notice tone="warning" style={styles.field}>{notice}</Notice>}
            <Input
                label={t("log.foodName")}
                placeholder={t("log.foodNamePlaceholder")}
                value={name}
                onChangeText={setName}
                autoFocus
            />

            <FieldLabel>{t("log.defaultUnit")}</FieldLabel>
            <UnitPicker
                unitOptions={unitOptions}
                selectedUnit={defaultUnit}
                onSelectUnit={(u) => setDefaultUnit(u)}
                servingUnits={[]}
                selectedServingUnit={null}
                onSelectServingUnit={() => { }}
                hideAddButton
            />

            <FieldLabel>{t("log.nutritionPer100g")}</FieldLabel>
            <Input
                label={t("settings.calories")}
                placeholder="0"
                suffix={t("common.kcal")}
                value={calories}
                onChangeText={setCalories}
                keyboardType="decimal-pad"
                containerStyle={styles.field}
            />
            <View style={styles.macroRow}>
                <Input
                    label={t("settings.protein")}
                    placeholder="0"
                    suffix={t("common.g")}
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="decimal-pad"
                    containerStyle={styles.macroField}
                />
                <Input
                    label={t("settings.carbs")}
                    placeholder="0"
                    suffix={t("common.g")}
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="decimal-pad"
                    containerStyle={styles.macroField}
                />
                <Input
                    label={t("settings.fat")}
                    placeholder="0"
                    suffix={t("common.g")}
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="decimal-pad"
                    containerStyle={styles.macroField}
                />
            </View>
            <Input
                label={t("log.barcode")}
                placeholder={t("log.barcodePlaceholder")}
                value={barcode}
                onChangeText={setBarcode}
                keyboardType="number-pad"
                containerStyle={styles.field}
            />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    field: { marginBottom: spacing.md },
    macroRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    macroField: { flex: 1 },
});
