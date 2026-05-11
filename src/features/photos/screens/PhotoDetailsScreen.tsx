import { getRecentWorkouts, type Workout } from "@/src/features/exercise/services/workoutDb";
import PhotoMetadataCard from "@/src/features/photos/components/PhotoMetadataCard";
import WorkoutPickerModal from "@/src/features/photos/components/WorkoutPickerModal";
import { createPhoto } from "@/src/features/photos/services/photoDb";
import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

interface PhotoDraft {
    id: string;
    uri: string;
    workoutId: number | null;
    minutesAfterWorkout: string;
    notes: string;
}

export default function PhotoDetailsScreen() {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams<{ count?: string; images?: string | string[] }>();
    const count = Number(params.count ?? 0) || 0;
    const [drafts, setDrafts] = useState<PhotoDraft[]>([]);
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const recentWorkouts = getRecentWorkouts(20);
        setWorkouts(recentWorkouts);

        const raw = Array.isArray(params.images) ? params.images[0] : params.images;
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as string[];
            if (!Array.isArray(parsed)) return;

            setDrafts(
                parsed
                    .filter((uri) => typeof uri === "string" && uri.length > 0)
                    .map((uri, index) => ({
                        id: `${uri}-${index}`,
                        uri,
                        workoutId: null,
                        minutesAfterWorkout: "",
                        notes: "",
                    })),
            );
        } catch {
            setDrafts([]);
        }
    }, [params.images]);

    const activeDraft = useMemo(
        () => drafts.find((draft) => draft.id === activeDraftId) ?? null,
        [activeDraftId, drafts],
    );

    function updateDraft(id: string, changes: Partial<PhotoDraft>) {
        setDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, ...changes } : draft)));
    }

    function getWorkoutLabel(workoutId: number | null) {
        if (!workoutId) return t("log.photoDetailsNoWorkout");
        const workout = workouts.find((item) => item.id === workoutId);
        if (!workout) return t("log.photoDetailsNoWorkout");
        return workout.title?.trim() ? workout.title : t("log.photoDetailsUntitledWorkout");
    }

    function buildNotes(draft: PhotoDraft) {
        if (!draft.workoutId || !draft.minutesAfterWorkout.trim()) return draft.notes.trim() || null;

        const minutes = Number(draft.minutesAfterWorkout);
        if (!Number.isFinite(minutes) || minutes < 0) return draft.notes.trim() || null;

        const workoutTitle = getWorkoutLabel(draft.workoutId);
        const autoTag = t("log.photoDetailsTagSummary", { minutes: Math.trunc(minutes), workout: workoutTitle });

        const manualNotes = draft.notes.trim();
        if (!manualNotes) return autoTag;
        return `${autoTag}\n\n${manualNotes}`;
    }

    function handleSelectWorkout(workoutId: number | null) {
        if (!activeDraftId) return;
        updateDraft(activeDraftId, { workoutId });
        setActiveDraftId(null);
    }

    async function handleSave() {
        if (drafts.length === 0) {
            Alert.alert(t("log.photoDetailsTitle"), t("log.photoDetailsMissingImages"));
            return;
        }

        setIsSaving(true);
        try {
            for (const draft of drafts) {
                createPhoto({
                    log_entry_id: null,
                    image_path: draft.uri,
                    image_data: null,
                    workout_tag_id: draft.workoutId,
                    notes: buildNotes(draft),
                });
            }

            Alert.alert(t("log.photoDetailsTitle"), t("log.photoDetailsSaveSuccess", { count: drafts.length }));
            router.replace("/(tabs)");
        } catch (error) {
            const message = error instanceof Error && error.message ? error.message : t("common.unknownError");
            Alert.alert(t("log.photoDetailsSaveErrorTitle"), t("log.photoDetailsSaveErrorMessage", { message }));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.title}>{t("log.photoDetailsTitle")}</Text>
                    <Text style={styles.body}>{t("log.photoDetailsSummary", { count: drafts.length || count })}</Text>
                    <Text style={styles.hint}>{t("log.photoDetailsHint")}</Text>
                </View>

                {drafts.length === 0 ? (
                    <Text style={styles.emptyText}>{t("log.photoDetailsMissingImages")}</Text>
                ) : (
                    drafts.map((draft) => (
                        <PhotoMetadataCard
                            key={draft.id}
                            uri={draft.uri}
                            workoutLabel={getWorkoutLabel(draft.workoutId)}
                            minutesAfterWorkout={draft.minutesAfterWorkout}
                            notes={draft.notes}
                            onOpenWorkoutPicker={() => setActiveDraftId(draft.id)}
                            onMinutesChange={(value) => updateDraft(draft.id, { minutesAfterWorkout: value })}
                            onNotesChange={(value) => updateDraft(draft.id, { notes: value })}
                        />
                    ))
                )}
            </ScrollView>

            <View style={styles.footer}>
                <Button title={t("common.cancel")} onPress={() => router.back()} variant="outline" />
                <Button title={t("log.photoDetailsSaveButton")} onPress={handleSave} disabled={isSaving || drafts.length === 0} />
            </View>

            <WorkoutPickerModal
                visible={!!activeDraft}
                workouts={workouts}
                selectedWorkoutId={activeDraft?.workoutId ?? null}
                onSelectWorkout={handleSelectWorkout}
                onClose={() => setActiveDraftId(null)}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        content: {
            padding: spacing.md,
            gap: spacing.md,
        },
        card: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            padding: spacing.md,
            gap: spacing.sm,
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        body: {
            fontSize: fontSize.md,
            color: colors.text,
        },
        hint: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        emptyText: {
            fontSize: fontSize.md,
            color: colors.textSecondary,
        },
        footer: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            gap: spacing.sm,
        },
    });
}
