import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExerciseTemplate } from "../services/exerciseDb";

interface ExerciseRowProps {
    template: ExerciseTemplate;
    onAddEmpty: () => void;
    onAddWithSets: () => void;
}

export default function ExerciseRow({ template, onAddEmpty, onAddWithSets }: ExerciseRowProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createRowStyles(colors), [colors]);

    return (
        <View style={styles.row}>
            <View style={styles.info}>
                <Text style={styles.name}>{template.name}</Text>
                {(template.muscle_group || template.equipment) && (
                    <Text style={styles.meta}>
                        {[template.muscle_group, template.equipment].filter(Boolean).join(" · ")}
                    </Text>
                )}
            </View>
            <Pressable
                onPress={onAddEmpty}
                hitSlop={8}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                accessibilityLabel={t("exercise.addExercise.addEmpty")}
            >
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </Pressable>
            <Pressable
                onPress={onAddWithSets}
                hitSlop={8}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                accessibilityLabel={t("exercise.addExercise.addWithSets")}
            >
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
            </Pressable>
        </View>
    );
}

function createRowStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        info: { flex: 1 },
        name: { fontSize: fontSize.md, color: colors.text, fontWeight: "500" },
        meta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
        iconBtn: {
            padding: spacing.xs,
            marginLeft: spacing.sm,
        },
        iconBtnPressed: { opacity: 0.5 },
    });
}
