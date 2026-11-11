// eslint-disable-next-line boundaries/dependencies
import PhotoGallery from "@/src/features/photos/components/PhotoGallery";
import { listPhotosByDateWithRelations } from "@/src/features/photos/services/photoDb";
import SectionCard from "@/src/shared/components/SectionCard";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface LogPhotosSectionProps {
    dateKey?: string;
    refreshKey?: number;
}

export default function LogPhotosSection({ dateKey, refreshKey }: LogPhotosSectionProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const [photos, setPhotos] = useState<ReturnType<typeof listPhotosByDateWithRelations>>([]);
    const [loading, setLoading] = useState(false);

    const loadPhotos = useCallback(() => {
        if (!dateKey) {
            setPhotos([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setPhotos(listPhotosByDateWithRelations(dateKey));
        setLoading(false);
    }, [dateKey]);

    useEffect(() => {
        queueMicrotask(loadPhotos);
    }, [loadPhotos, refreshKey]);

    useFocusEffect(
        useCallback(() => {
            loadPhotos();
        }, [loadPhotos]),
    );

    function navigateToAddPhotos() {
        router.push({ pathname: "/photos/photos", params: dateKey ? { dateKey } : undefined });
    }

    if (!loading && photos.length === 0) {
        return null;
    }

    return (
        <SectionCard
            icon="images-outline"
            title={t("log.photosTitle")}
            summary={t("log.photosLoggedCount", { count: photos.length })}
            onAdd={navigateToAddPhotos}
        >
            {loading ? (
                <View style={styles.photosLoadingRow}>
                    <ActivityIndicator color={colors.textSecondary} size="small" />
                    <Text style={styles.photosLoadingText}>{t("log.photosLoading")}</Text>
                </View>
            ) : (
                <View style={styles.gallery}>
                    <PhotoGallery photos={photos} emptyLabel={t("log.noPhotosLogged")} />
                </View>
            )}
        </SectionCard>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        gallery: { paddingVertical: spacing.sm + 4 },
        photosLoadingRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.md,
        },
        photosLoadingText: { fontSize: fontSize.sm, color: colors.textSecondary },
    });
}
