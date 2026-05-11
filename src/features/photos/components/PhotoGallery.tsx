import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Image } from "expo-image";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import PhotoModal from "./PhotoModal";
import type { PhotoWithRelations } from "../types";

interface PhotoGalleryProps {
    photos: PhotoWithRelations[];
    onPhotoPress?: (photo: PhotoWithRelations, index: number) => void;
    emptyLabel?: string;
}

const THUMBNAIL_WIDTH = 128;
const THUMBNAIL_HEIGHT = 128;
const TILE_WIDTH = THUMBNAIL_WIDTH + spacing.sm;

interface PhotoTileProps {
    photo: PhotoWithRelations;
    index: number;
    tagText: string;
    onPress?: (photo: PhotoWithRelations, index: number) => void;
    styles: ReturnType<typeof createStyles>;
}

const PhotoTile = React.memo(function PhotoTile({ photo, index, tagText, onPress, styles }: PhotoTileProps) {
    return (
        <Pressable style={styles.tile} onPress={() => onPress?.(photo, index)}>
            <View style={styles.imageWrapper}>
                {photo.image_path ? (
                    <Image
                        source={{ uri: photo.image_path }}
                        style={styles.image}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={120}
                    />
                ) : (
                    <View style={styles.imageFallback}>
                        <Text style={styles.imageFallbackText}>-</Text>
                    </View>
                )}
            </View>
            <Text style={styles.tag} numberOfLines={2}>
                {tagText}
            </Text>
        </Pressable>
    );
});

export default function PhotoGallery({ photos, onPhotoPress, emptyLabel }: PhotoGalleryProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [modalVisible, setModalVisible] = React.useState(false);
    const [activePhotoIndex, setActivePhotoIndex] = React.useState(0);

    const resolveTag = useCallback(
        (photo: PhotoWithRelations): string => {
            const firstNoteLine = photo.notes?.split("\n")[0]?.trim();
            if (firstNoteLine) return firstNoteLine;

            if (photo.workoutTag?.workoutTitle?.trim()) {
                return t("log.photosGalleryWorkoutFallback", { workout: photo.workoutTag.workoutTitle.trim() });
            }

            return t("log.photosGalleryNoWorkoutTag");
        },
        [t],
    );

    if (photos.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{emptyLabel ?? t("log.photosNoSelection")}</Text>
            </View>
        );
    }

    function handlePhotoPress(photo: PhotoWithRelations, index: number) {
        setActivePhotoIndex(index);
        setModalVisible(true);
        onPhotoPress?.(photo, index);
    }

    return (
        <>
            <FlatList
                data={photos}
                horizontal
                nestedScrollEnabled
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                keyExtractor={(item) => String(item.id)}
                onStartShouldSetResponderCapture={() => true}
                onMoveShouldSetResponderCapture={() => true}
                initialNumToRender={4}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews
                getItemLayout={(_, index) => ({
                    index,
                    length: TILE_WIDTH,
                    offset: TILE_WIDTH * index,
                })}
                renderItem={({ item, index }) => (
                    <PhotoTile
                        photo={item}
                        index={index}
                        onPress={handlePhotoPress}
                        tagText={resolveTag(item)}
                        styles={styles}
                    />
                )}
            />

            <PhotoModal
                visible={modalVisible}
                photos={photos}
                initialIndex={activePhotoIndex}
                onClose={() => setModalVisible(false)}
            />
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        listContent: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            gap: spacing.sm,
        },
        tile: {
            width: THUMBNAIL_WIDTH,
            gap: spacing.xs,
        },
        imageWrapper: {
            width: THUMBNAIL_WIDTH,
            height: THUMBNAIL_HEIGHT,
            borderRadius: borderRadius.md,
            overflow: "hidden",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        image: {
            width: "100%",
            height: "100%",
        },
        imageFallback: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primaryLight,
        },
        imageFallbackText: {
            color: colors.textSecondary,
            fontSize: fontSize.lg,
        },
        tag: {
            color: colors.textSecondary,
            fontSize: fontSize.xs,
            lineHeight: 16,
            minHeight: 32,
        },
        emptyState: {
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: "dashed",
            borderRadius: borderRadius.md,
            padding: spacing.md,
            alignItems: "center",
            justifyContent: "center",
            minHeight: THUMBNAIL_HEIGHT,
            marginHorizontal: spacing.md,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
        },
    });
}
