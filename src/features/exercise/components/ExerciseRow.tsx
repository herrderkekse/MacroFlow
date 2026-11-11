import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MUSCLE_GROUPS } from "../constants";
import type { ExerciseTemplate } from "../services/exerciseDb";

interface ExerciseRowProps {
    template: ExerciseTemplate;
    onAddEmpty: () => void;
    onAddWithSets: () => void;
}

/** One exercise in the picker: tap to add it, or copy the sets of its last session. */
export default function ExerciseRow({ template, onAddEmpty, onAddWithSets }: ExerciseRowProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createRowStyles(colors), [colors]);
    const muscleLabelKey = MUSCLE_GROUPS.find((mg) => mg.key === template.muscle_group)?.labelKey;
    const meta = [
        muscleLabelKey ? t(muscleLabelKey) : template.muscle_group,
        template.equipment ? t(`exercise.equipment.${template.equipment}`, { defaultValue: template.equipment }) : null,
    ].filter(Boolean).join(" · ");

    return (
        <Pressable
            onPress={onAddEmpty}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${t("exercise.addExercise.addEmpty")}: ${template.name}`}
        >
            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{template.name}</Text>
                {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
            </View>
            <IconButton
                icon="copy-outline"
                size="sm"
                label={t("exercise.addExercise.addWithSets")}
                onPress={onAddWithSets}
            />
            <IconButton
                icon="add"
                size="sm"
                variant="tonal"
                label={t("exercise.addExercise.addEmpty")}
                onPress={onAddEmpty}
            />
        </Pressable>
    );
}

function createRowStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: 56,
            paddingVertical: spacing.sm,
            paddingHorizontal: screenPadding,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        info: { flex: 1 },
        name: { fontSize: fontSize.md, color: colors.text, fontWeight: "500" },
        meta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    });
}
