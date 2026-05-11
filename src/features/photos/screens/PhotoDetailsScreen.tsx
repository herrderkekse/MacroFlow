import { getWorkoutsByDate, type Workout } from "@/src/features/exercise/services/workoutDb";
import WorkoutPickerModal from "@/src/features/photos/components/WorkoutPickerModal";
import { createPhoto, createPhotoForDate } from "@/src/features/photos/services/photoDb";
import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function PhotoDetailsScreen() {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams<{ count?: string; images?: string | string[]; dateKey?: string }>();
    const count = Number(params.count ?? 0) || 0;
    const [imageUris, setImageUris] = useState<string[]>([]);
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
    const [minutesAfterWorkout, setMinutesAfterWorkout] = useState("");
    const [notes, setNotes] = useState("");
    const [pickerVisible, setPickerVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const dateKey = Array.isArray(params.dateKey) ? params.dateKey[0] : params.dateKey;
        if (dateKey) {
            const dayWorkouts = getWorkoutsByDate(dateKey);
            setWorkouts(dayWorkouts);
        }

        const raw = Array.isArray(params.images) ? params.images[0] : params.images;
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as string[];
            if (Array.isArray(parsed)) {
                setImageUris(parsed.filter((uri) => typeof uri === "string" && uri.length > 0));
            }
        } catch {
            setImageUris([]);
        }
    }, [params.images, params.dateKey]);

    function getWorkoutLabel(workoutId: number | null) {
        if (!workoutId) return t("log.photoDetailsNoWorkout");
        const workout = workouts.find((item) => item.id === workoutId);
        if (!workout) return t("log.photoDetailsNoWorkout");
        return workout.title?.trim() ? workout.title : t("log.photoDetailsUntitledWorkout");
    }

    function buildNotes() {
        if (!selectedWorkoutId || !minutesAfterWorkout.trim()) return notes.trim() || null;

        const minutes = Number(minutesAfterWorkout);
        if (!Number.isFinite(minutes) || minutes < 0) return notes.trim() || null;

        const workoutTitle = getWorkoutLabel(selectedWorkoutId);
        const autoTag = t("log.photoDetailsTagSummary", { minutes: Math.trunc(minutes), workout: workoutTitle });

        const manualNotes = notes.trim();
        if (!manualNotes) return autoTag;
        return `${autoTag}\n\n${manualNotes}`;
    }

    async function handleSave() {
        if (imageUris.length === 0) {
            Alert.alert(t("log.photoDetailsTitle"), t("log.photoDetailsMissingImages"));
            return;
        }

        setIsSaving(true);
        try {
            const builtNotes = buildNotes();
            const dateKey = Array.isArray(params.dateKey) ? params.dateKey[0] : params.dateKey;
            for (const uri of imageUris) {
                const payload = {
                    log_entry_id: null,
                    image_path: uri,
                    image_data: null,
                    workout_tag_id: selectedWorkoutId,
                    notes: builtNotes,
                };

                if (dateKey) {
                    createPhotoForDate(payload, dateKey);
                } else {
                    createPhoto(payload);
                }
            }

            Alert.alert(t("log.photoDetailsTitle"), t("log.photoDetailsSaveSuccess", { count: imageUris.length }));
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
                    <Text style={styles.body}>{t("log.photoDetailsSummary", { count: imageUris.length || count })}</Text>
                    <Text style={styles.hint}>{t("log.photoDetailsHint")}</Text>
                </View>

                {imageUris.length === 0 ? (
                    <Text style={styles.emptyText}>{t("log.photoDetailsMissingImages")}</Text>
                ) : (
                    <>
                        <View style={styles.previews}>
                            <FlatList
                                data={imageUris}
                                keyExtractor={(uri, idx) => `${uri}-${idx}`}
                                numColumns={3}
                                columnWrapperStyle={styles.gridRow}
                                scrollEnabled={false}
                                renderItem={({ item }) => (
                                    <Image source={{ uri: item }} style={styles.thumbnail} contentFit="cover" />
                                )}
                            />
                        </View>

                        <View style={styles.formCard}>
                            <Text style={styles.label}>{t("log.photoDetailsWorkoutLabel")}</Text>
                            <Pressable style={styles.workoutPicker} onPress={() => setPickerVisible(true)}>
                                <Text style={styles.workoutPickerText}>{getWorkoutLabel(selectedWorkoutId)}</Text>
                            </Pressable>

                            <Input
                                label={t("log.photoDetailsMinutesLabel")}
                                value={minutesAfterWorkout}
                                onChangeText={setMinutesAfterWorkout}
                                keyboardType="number-pad"
                                placeholder={t("log.photoDetailsMinutesPlaceholder")}
                            />

                            <Input
                                label={t("log.photoDetailsNotesLabel")}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder={t("log.photoDetailsNotesPlaceholder")}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                style={styles.notesInput}
                            />
                        </View>
                    </>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <Button title={t("common.cancel")} onPress={() => router.back()} variant="outline" />
                <Button title={t("log.photoDetailsSaveButton")} onPress={handleSave} disabled={isSaving || imageUris.length === 0} />
            </View>

            <WorkoutPickerModal
                visible={pickerVisible}
                workouts={workouts}
                selectedWorkoutId={selectedWorkoutId}
                onSelectWorkout={(id) => {
                    setSelectedWorkoutId(id);
                    setPickerVisible(false);
                }}
                onClose={() => setPickerVisible(false)}
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
        previews: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            padding: spacing.sm,
        },
        gridRow: {
            gap: spacing.sm,
        },
        thumbnail: {
            flex: 1,
            aspectRatio: 1,
            borderRadius: borderRadius.md,
        },
        formCard: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            padding: spacing.md,
            gap: spacing.sm,
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
        footer: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            gap: spacing.sm,
        },
    });
}
