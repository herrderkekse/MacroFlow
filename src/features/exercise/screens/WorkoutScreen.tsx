import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import AddExerciseModal from "../components/AddExerciseModal";
import ExerciseCard from "../components/ExerciseCard";
import WorkoutHeader from "../components/WorkoutHeader";
import { useWorkout } from "../hooks/useWorkout";
import { updateWorkoutExercise, type ExerciseTemplate, type WorkoutExerciseWithSets } from "../services/exerciseDb";

export default function WorkoutScreen() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const params = useLocalSearchParams<{ workoutId?: string }>();
    const workoutId = params.workoutId ? Number(params.workoutId) : undefined;

    const workout = useWorkout({ workoutId });
    const [showAddExercise, setShowAddExercise] = useState(false);

    // Auto-start workout if none loaded
    if (!workout.data && !workoutId) {
        workout.startWorkout();
    }

    const isFinished = !!workout.data?.workout.ended_at;

    function handleExerciseSelected(template: ExerciseTemplate) {
        workout.addExercise(template.id);
        setShowAddExercise(false);
    }

    function handleFinish() {
        workout.finishCurrentWorkout();
        router.back();
    }

    function handleBack() {
        router.back();
    }

    function handleNoteChange(workoutExerciseId: number, note: string) {
        updateWorkoutExercise(workoutExerciseId, { notes: note || null });
        workout.reload();
    }

    function handleMoveUp(workoutExerciseId: number) {
        const exercises = workout.data?.exercises ?? [];
        const idx = exercises.findIndex((e) => e.workoutExercise.id === workoutExerciseId);
        if (idx > 0) {
            workout.moveExercise(workoutExerciseId, idx);
        }
    }

    function handleMoveDown(workoutExerciseId: number) {
        const exercises = workout.data?.exercises ?? [];
        const idx = exercises.findIndex((e) => e.workoutExercise.id === workoutExerciseId);
        if (idx < exercises.length - 1) {
            workout.moveExercise(workoutExerciseId, idx + 2);
        }
    }

    function renderExercise({ item, index }: { item: WorkoutExerciseWithSets; index: number }) {
        return (
            <ExerciseCard
                item={item}
                index={index}
                totalExercises={workout.data?.exercises.length ?? 0}
                isFinished={isFinished}
                onRemove={workout.removeExercise}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onNoteChange={handleNoteChange}
            />
        );
    }

    return (
        <View style={styles.screen}>
            <Stack.Screen options={{ headerShown: false }} />

            <WorkoutHeader
                title={workout.data?.workout.title || t("exercise.workout.defaultTitle")}
                elapsedMs={workout.elapsedMs}
                isFinished={isFinished}
                hasUnfinishedSets={workout.hasUnfinishedSets}
                onTitleChange={workout.updateTitle}
                onFinish={handleFinish}
                onBack={handleBack}
            />

            <FlatList
                data={workout.data?.exercises ?? []}
                keyExtractor={(item) => String(item.workoutExercise.id)}
                renderItem={renderExercise}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Ionicons name="barbell-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>{t("exercise.workout.emptyState")}</Text>
                    </View>
                }
                ListFooterComponent={
                    !isFinished ? (
                        <Button
                            title={t("exercise.workout.addExercise")}
                            variant="outline"
                            icon={<Ionicons name="add" size={18} color={colors.text} />}
                            onPress={() => setShowAddExercise(true)}
                            style={styles.addBtn}
                        />
                    ) : null
                }
            />

            <AddExerciseModal
                visible={showAddExercise}
                onClose={() => setShowAddExercise(false)}
                onSelect={handleExerciseSelected}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: colors.background,
        },
        list: {
            padding: spacing.md,
            paddingBottom: 100,
        },
        emptyWrap: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.xl * 2,
            gap: spacing.md,
        },
        emptyText: {
            fontSize: 14,
            color: colors.textTertiary,
            textAlign: "center",
        },
        addBtn: {
            marginTop: spacing.sm,
        },
    });
}
