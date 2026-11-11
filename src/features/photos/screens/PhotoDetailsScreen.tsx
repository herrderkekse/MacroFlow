import { getWorkoutsByDate, type Workout } from "@/src/features/exercise/services/workoutDb";
import WorkoutPickerSheet from "@/src/features/photos/components/WorkoutPickerSheet";
import { createPhoto, createPhotoForDate } from "@/src/features/photos/services/photoDb";
import Button from "@/src/shared/atoms/Button";
import EmptyState from "@/src/shared/atoms/EmptyState";
import Input from "@/src/shared/atoms/Input";
import SelectField from "@/src/shared/atoms/SelectField";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";

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
        queueMicrotask(() => {
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
        });
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
            <ScreenHeader
                title={t("log.photoDetailsTitle")}
                subtitle={t("log.photoDetailsSummary", { count: imageUris.length || count })}
            />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {imageUris.length === 0 ? (
                    <EmptyState icon="image-outline" title={t("log.photoDetailsMissingImages")} />
                ) : (
                    <>
                        <FlatList
                            data={imageUris}
                            keyExtractor={(uri, idx) => `${uri}-${idx}`}
                            numColumns={3}
                            columnWrapperStyle={styles.gridRow}
                            contentContainerStyle={styles.grid}
                            scrollEnabled={false}
                            renderItem={({ item }) => (
                                <Image source={{ uri: item }} style={styles.thumbnail} contentFit="cover" />
                            )}
                        />

                        <Text style={styles.hint}>{t("log.photoDetailsHint")}</Text>

                        <SelectField
                            label={t("log.photoDetailsWorkoutLabel")}
                            value={getWorkoutLabel(selectedWorkoutId)}
                            onPress={() => setPickerVisible(true)}
                            containerStyle={styles.field}
                        />

                        <Input
                            label={t("log.photoDetailsMinutesLabel")}
                            value={minutesAfterWorkout}
                            onChangeText={setMinutesAfterWorkout}
                            keyboardType="number-pad"
                            placeholder={t("log.photoDetailsMinutesPlaceholder")}
                            containerStyle={styles.field}
                        />

                        <Input
                            label={t("log.photoDetailsNotesLabel")}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder={t("log.photoDetailsNotesPlaceholder")}
                            multiline
                            style={styles.notesInput}
                        />
                    </>
                )}
            </ScrollView>

            <FooterBar>
                <Button title={t("log.photoDetailsSaveButton")} onPress={handleSave} disabled={isSaving || imageUris.length === 0} />
            </FooterBar>

            <WorkoutPickerSheet
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
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xl },
        grid: { gap: spacing.sm },
        gridRow: { gap: spacing.sm },
        thumbnail: { flex: 1, aspectRatio: 1, borderRadius: borderRadius.md },
        hint: {
            fontSize: fontSize.sm,
            lineHeight: 20,
            color: colors.textSecondary,
            marginTop: spacing.md,
            marginBottom: spacing.md,
        },
        field: { marginBottom: spacing.md },
        notesInput: { minHeight: 84 },
    });
}
