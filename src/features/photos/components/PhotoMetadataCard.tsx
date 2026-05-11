import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Image } from "expo-image";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface PhotoMetadataCardProps {
    uri: string;
    workoutLabel: string;
    minutesAfterWorkout: string;
    notes: string;
    onOpenWorkoutPicker: () => void;
    onMinutesChange: (value: string) => void;
    onNotesChange: (value: string) => void;
}

export default function PhotoMetadataCard({
    uri,
    workoutLabel,
    minutesAfterWorkout,
    notes,
    onOpenWorkoutPicker,
    onMinutesChange,
    onNotesChange,
}: PhotoMetadataCardProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();

    return (
        <View style={styles.photoCard}>
            <Image source={{ uri }} style={styles.preview} contentFit="cover" />

            <Text style={styles.label}>{t("log.photoDetailsWorkoutLabel")}</Text>
            <Pressable style={styles.workoutPicker} onPress={onOpenWorkoutPicker}>
                <Text style={styles.workoutPickerText}>{workoutLabel}</Text>
            </Pressable>

            <Input
                label={t("log.photoDetailsMinutesLabel")}
                value={minutesAfterWorkout}
                onChangeText={onMinutesChange}
                keyboardType="number-pad"
                placeholder={t("log.photoDetailsMinutesPlaceholder")}
            />

            <Input
                label={t("log.photoDetailsNotesLabel")}
                value={notes}
                onChangeText={onNotesChange}
                placeholder={t("log.photoDetailsNotesPlaceholder")}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={styles.notesInput}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        photoCard: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            padding: spacing.sm,
            gap: spacing.sm,
        },
        preview: {
            width: "100%",
            height: 220,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background,
        },
        label: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            fontWeight: "500",
        },
        workoutPicker: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: colors.background,
        },
        workoutPickerText: {
            color: colors.text,
            fontSize: fontSize.md,
        },
        notesInput: {
            minHeight: 84,
            paddingTop: spacing.sm,
        },
    });
}
