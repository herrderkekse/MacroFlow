import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
        <View style={styles.container}>
            <Text style={styles.fieldLabel}>{t("exercise.createExercise.customFields")}</Text>
            <Text style={styles.hint}>{t("exercise.createExercise.customFieldsHint")}</Text>

            {fields.map((field) => (
                <View key={field.id} style={styles.fieldRow}>
                    <TextInput
                        style={[styles.input, styles.nameInput]}
                        value={field.name}
                        onChangeText={(v) => update(field.id, { name: v })}
                        placeholder={t("exercise.createExercise.customFieldName")}
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="done"
                    />
                    <TextInput
                        style={[styles.input, styles.unitInput]}
                        value={field.unit}
                        onChangeText={(v) => update(field.id, { unit: v })}
                        placeholder={t("exercise.createExercise.customFieldUnit")}
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="done"
                    />
                    <Pressable
                        onPress={() => update(field.id, { higherIsBetter: !field.higherIsBetter })}
                        style={styles.dirToggle}
                        hitSlop={6}
                    >
                        <Ionicons
                            name={field.higherIsBetter ? "arrow-up" : "arrow-down"}
                            size={18}
                            color={colors.primary}
                        />
                    </Pressable>
                    <Pressable onPress={() => remove(field.id)} style={styles.removeBtn} hitSlop={6}>
                        <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                    </Pressable>
                </View>
            ))}

            <Pressable onPress={add} style={styles.addBtn}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addText}>{t("exercise.createExercise.addCustomField")}</Text>
            </Pressable>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { gap: spacing.sm },
        fieldLabel: {
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.textSecondary,
            marginBottom: spacing.xs,
        },
        hint: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            marginTop: -spacing.xs,
        },
        fieldRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        input: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            fontSize: fontSize.md,
            color: colors.text,
        },
        nameInput: { flex: 1 },
        unitInput: { width: 72 },
        dirToggle: {
            width: 32,
            height: 32,
            borderRadius: borderRadius.sm,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primaryLight,
        },
        removeBtn: {
            alignItems: "center",
            justifyContent: "center",
        },
        addBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingVertical: spacing.xs,
        },
        addText: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.primary,
        },
    });
}
