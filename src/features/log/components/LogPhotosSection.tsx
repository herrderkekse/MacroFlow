// eslint-disable-next-line boundaries/dependencies
import PhotoGallery from "@/src/features/photos/components/PhotoGallery";
import { listPhotosByDateWithRelations } from "@/src/features/photos/services/photoDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

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
        loadPhotos();
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
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Ionicons name="images-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.sectionHeaderLabel}>{t("log.photosTitle")}</Text>
                <Text style={styles.sectionCountLabel}>{t("log.photosLoggedCount", { count: photos.length })}</Text>
                <Pressable onPress={navigateToAddPhotos} hitSlop={8}>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.photosLoadingRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.photosLoadingText}>{t("log.photosLoading")}</Text>
                </View>
            ) : (
                <PhotoGallery photos={photos} emptyLabel={t("log.noPhotosLogged")} />
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        sectionContainer: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        sectionHeaderLabel: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        sectionCountLabel: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
        },
        photosLoadingRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.sm,
            paddingVertical: spacing.sm,
        },
        photosLoadingText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
    });
}
