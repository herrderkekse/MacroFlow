import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import AddExerciseModal from "../components/AddExerciseModal";
import type { ExerciseTemplate } from "../services/exerciseDb";

export default function WorkoutScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const [showAddExercise, setShowAddExercise] = useState(false);

    function handleExerciseSelected(_template: ExerciseTemplate) {
        setShowAddExercise(false);
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <Button
                title={t("exercise.workout.addExercise")}
                variant="outline"
                icon={<Ionicons name="add" size={18} color={colors.text} />}
                onPress={() => setShowAddExercise(true)}
            />
            <AddExerciseModal
                visible={showAddExercise}
                onClose={() => setShowAddExercise(false)}
                onSelect={handleExerciseSelected}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, alignItems: "center", justifyContent: "center" },
});
