import Button from "@/src/shared/atoms/Button";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import IconButton from "@/src/shared/atoms/IconButton";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { newCustomFieldId, type CustomField } from "../helpers/customFields";

interface CustomFieldsEditorProps {
    fields: CustomField[];
    onChange: (fields: CustomField[]) => void;
}

export default function CustomFieldsEditor({ fields, onChange }: CustomFieldsEditorProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    function update(id: string, patch: Partial<CustomField>) {
        onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    }

    function remove(id: string) {
        onChange(fields.filter((f) => f.id !== id));
    }

    function add() {
        onChange([...fields, { id: newCustomFieldId(), name: "", unit: "", higherIsBetter: true }]);
    }

    return (
        <View>
            <FieldLabel>{t("exercise.createExercise.customFields")}</FieldLabel>
            <Text style={styles.hint}>{t("exercise.createExercise.customFieldsHint")}</Text>

            {fields.map((field) => (
                <View key={field.id} style={styles.fieldRow}>
                    <Input
                        value={field.name}
                        onChangeText={(v) => update(field.id, { name: v })}
                        placeholder={t("exercise.createExercise.customFieldName")}
                        returnKeyType="done"
                        containerStyle={styles.nameInput}
                    />
                    <Input
                        value={field.unit}
                        onChangeText={(v) => update(field.id, { unit: v })}
                        placeholder={t("exercise.createExercise.customFieldUnit")}
                        returnKeyType="done"
                        containerStyle={styles.unitInput}
                    />
                    <IconButton
                        icon={field.higherIsBetter ? "arrow-up" : "arrow-down"}
                        variant="tonal"
                        size="sm"
                        label={t(field.higherIsBetter ? "exercise.createExercise.higherIsBetter" : "exercise.createExercise.lowerIsBetter")}
                        onPress={() => update(field.id, { higherIsBetter: !field.higherIsBetter })}
                    />
                    <IconButton
                        icon="close"
                        size="sm"
                        color={colors.textTertiary}
                        label={t("common.delete")}
                        onPress={() => remove(field.id)}
                    />
                </View>
            ))}

            <Button
                title={t("exercise.createExercise.addCustomField")}
                variant="outline"
                size="sm"
                icon={<Ionicons name="add" size={16} color={colors.text} />}
                onPress={add}
                style={styles.addBtn}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        hint: { fontSize: fontSize.xs, lineHeight: 17, color: colors.textSecondary, marginBottom: spacing.sm },
        fieldRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
        nameInput: { flex: 2 },
        unitInput: { flex: 1 },
        addBtn: { alignSelf: "flex-start" },
    });
}
