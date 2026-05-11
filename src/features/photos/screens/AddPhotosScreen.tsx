import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

interface SelectedImage {
    id: string;
    uri: string;
}

const MAX_SELECTION = 10;

export default function AddPhotosScreen() {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const router = useRouter();
    const [images, setImages] = useState<SelectedImage[]>([]);
    const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

    async function handlePickFromGallery() {
        const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
            Alert.alert(t("log.photosPermissionTitle"), t("log.photosLibraryPermissionMessage"));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsMultipleSelection: true,
            orderedSelection: true,
            selectionLimit: MAX_SELECTION,
            quality: 0.8,
        });

        if (result.canceled) return;

        const selected = result.assets.map((asset) => ({
            id: `${asset.assetId ?? asset.uri}-${Date.now()}`,
            uri: asset.uri,
        }));

        setImages((prev) => [...prev, ...selected].slice(0, MAX_SELECTION));
    }

    async function handleTakePhoto() {
        if (!cameraPermission?.granted) {
            const permission = await requestCameraPermission();
            if (!permission.granted) {
                Alert.alert(t("log.photosPermissionTitle"), t("log.photosCameraPermissionMessage"));
                return;
            }
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (result.canceled) return;

        const captured = result.assets.map((asset) => ({
            id: `${asset.assetId ?? asset.uri}-${Date.now()}`,
            uri: asset.uri,
        }));

        setImages((prev) => [...prev, ...captured].slice(0, MAX_SELECTION));
    }

    function handleRemoveImage(id: string) {
        setImages((prev) => prev.filter((img) => img.id !== id));
    }

    function handleNext() {
        router.push({
            pathname: "/photos/photo-details",
            params: { count: String(images.length) },
        });
    }

    return (
        <View style={styles.container}>
            <Text style={styles.description}>{t("log.photosDescription")}</Text>

            <View style={styles.actionsRow}>
                <Button
                    title={t("log.photosPickFromGallery")}
                    onPress={handlePickFromGallery}
                    variant="outline"
                    icon={<Ionicons name="images-outline" size={18} color={colors.text} />}
                    style={styles.actionButton}
                />
                <Button
                    title={t("log.photosTakePhoto")}
                    onPress={handleTakePhoto}
                    icon={<Ionicons name="camera-outline" size={18} color="#FFFFFF" />}
                    style={styles.actionButton}
                />
            </View>

            <Text style={styles.counter}>{t("log.photosSelectedCount", { count: images.length })}</Text>

            {images.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="image-outline" size={36} color={colors.textTertiary} />
                    <Text style={styles.emptyText}>{t("log.photosNoSelection")}</Text>
                </View>
            ) : (
                <FlatList
                    data={images}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    columnWrapperStyle={styles.gridRow}
                    contentContainerStyle={styles.grid}
                    renderItem={({ item }) => (
                        <View style={styles.tile}>
                            <Image source={{ uri: item.uri }} style={styles.image} contentFit="cover" />
                            <Pressable style={styles.removeBtn} onPress={() => handleRemoveImage(item.id)}>
                                <Ionicons name="close" size={16} color="#FFFFFF" />
                            </Pressable>
                        </View>
                    )}
                />
            )}

            <Button
                title={t("log.photosNextStep")}
                onPress={handleNext}
                disabled={images.length === 0}
                style={styles.nextButton}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            padding: spacing.md,
        },
        description: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            marginBottom: spacing.md,
        },
        actionsRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        actionButton: {
            flex: 1,
        },
        counter: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
        },
        emptyState: {
            flex: 1,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: fontSize.md,
        },
        grid: {
            paddingBottom: spacing.md,
            gap: spacing.sm,
        },
        gridRow: {
            gap: spacing.sm,
        },
        tile: {
            flex: 1,
            aspectRatio: 1,
            borderRadius: borderRadius.md,
            overflow: "hidden",
            backgroundColor: colors.surface,
        },
        image: {
            width: "100%",
            height: "100%",
        },
        removeBtn: {
            position: "absolute",
            top: spacing.xs,
            right: spacing.xs,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "rgba(0,0,0,0.65)",
            alignItems: "center",
            justifyContent: "center",
        },
        nextButton: {
            marginTop: spacing.sm,
        },
    });
}
