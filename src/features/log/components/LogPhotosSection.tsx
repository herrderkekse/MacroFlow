// eslint-disable-next-line boundaries/dependencies
import PhotoGallery from "@/src/features/photos/components/PhotoGallery";
import { listPhotosByDateWithRelations } from "@/src/features/photos/services/photoDb";
import SectionCard from "@/src/shared/components/SectionCard";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface LogPhotosSectionProps {
    dateKey?: string;
    refreshKey?: number;
}

/** The day's progress photos as a row of tiles; "+ PHOTOS" attaches more. Hidden while there are none. */
export default function LogPhotosSection({ dateKey, refreshKey }: LogPhotosSectionProps) {
    const { t } = useTranslation();
    const [photos, setPhotos] = useState<ReturnType<typeof listPhotosByDateWithRelations>>([]);

    const loadPhotos = useCallback(() => {
        setPhotos(dateKey ? listPhotosByDateWithRelations(dateKey) : []);
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

    // Most days have none; the section only appears once there is one.
    if (photos.length === 0) return null;

    return (
        <SectionCard
            title={t("log.photos")}
            hint={t("log.photosLoggedCount", { count: photos.length })}
            onAdd={navigateToAddPhotos}
            addLabel={t("log.addPhotos")}
            bare
        >
            <PhotoGallery photos={photos} onAdd={navigateToAddPhotos} addLabel={t("log.addPhotos")} />
        </SectionCard>
    );
}
