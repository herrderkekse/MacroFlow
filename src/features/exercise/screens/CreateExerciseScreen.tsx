import Button from "@/src/shared/atoms/Button";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing } from "@/src/utils/theme";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import ExerciseFormFields from "../components/ExerciseFormFields";
import { useExerciseForm } from "../hooks/useExerciseForm";

export default function CreateExerciseScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { exerciseId, initialName } = useLocalSearchParams<{ exerciseId?: string; initialName?: string }>();
    const parsedId = exerciseId ? Number(exerciseId) : undefined;
    const form = useExerciseForm({ active: true, exerciseId: parsedId, initialName });

    function handleSave() {
        if (form.save()) router.back();
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title={t(form.isEditing ? "exercise.createExercise.editTitle" : "exercise.createExercise.title")}
            />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <ExerciseFormFields form={form} autoFocus={!form.isEditing} />
            </ScrollView>
            <FooterBar>
                <Button title={t("common.save")} onPress={handleSave} />
            </FooterBar>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xl },
});
