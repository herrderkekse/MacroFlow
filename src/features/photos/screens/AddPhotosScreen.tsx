import Button from "@/src/shared/atoms/Button";
import EmptyState from "@/src/shared/atoms/EmptyState";
import IconButton from "@/src/shared/atoms/IconButton";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";

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
    const params = useLocalSearchParams<{ dateKey?: string | string[] }>();
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
        const imageUris = images.map((image) => image.uri);
        const dateKey = Array.isArray(params.dateKey) ? params.dateKey[0] : params.dateKey;
        router.push({
            pathname: "/photos/photo-details",
            params: {
                count: String(images.length),
                images: JSON.stringify(imageUris),
                dateKey: dateKey || "",
            },
        });
    }

    return (
        <View style={styles.screen}>
            <ScreenHeader
                title={t("log.photosTitle")}
                subtitle={images.length > 0 ? t("log.photosSelectedCount", { count: images.length }) : undefined}
            />
            <View style={styles.content}>
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
                        variant="outline"
                        icon={<Ionicons name="camera-outline" size={18} color={colors.text} />}
                        style={styles.actionButton}
                    />
                </View>

                {images.length === 0 ? (
                    <EmptyState icon="image-outline" title={t("log.photosNoSelection")} style={styles.emptyState} />
                ) : (
                    <FlatList
                        data={images}
                        keyExtractor={(item) => item.id}
                        numColumns={3}
                        columnWrapperStyle={styles.gridRow}
                        contentContainerStyle={styles.grid}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View style={styles.tile}>
                                <Image source={{ uri: item.uri }} style={styles.image} contentFit="cover" />
                                <IconButton
                                    icon="close"
                                    size="sm"
                                    variant="filled"
                                    label={t("common.delete")}
                                    onPress={() => handleRemoveImage(item.id)}
                                    style={styles.removeBtn}
                                />
                            </View>
                        )}
                    />
                )}
            </View>
            <FooterBar>
                <Button title={t("log.photosNextStep")} onPress={handleNext} disabled={images.length === 0} />
            </FooterBar>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { flex: 1, paddingHorizontal: screenPadding, paddingTop: spacing.sm },
        description: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.md },
        actionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
        actionButton: { flex: 1 },
        emptyState: {
            flex: 1,
            justifyContent: "center",
            marginBottom: spacing.md,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.borderStrong,
            borderRadius: borderRadius.lg,
        },
        grid: { paddingBottom: spacing.md, gap: spacing.sm },
        gridRow: { gap: spacing.sm },
        tile: {
            flex: 1,
            aspectRatio: 1,
            borderRadius: borderRadius.md,
            overflow: "hidden",
            backgroundColor: colors.surface,
        },
        image: { width: "100%", height: "100%" },
        removeBtn: { position: "absolute", top: spacing.xs, right: spacing.xs, width: 26, height: 26 },
    });
}
