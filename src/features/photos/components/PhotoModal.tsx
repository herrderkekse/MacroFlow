import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { spacing } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Animated,
    Dimensions,
    FlatList,
    Modal,
    PanResponder,
    Pressable,
    Text,
    View,
    type NativeSyntheticEvent,
    type NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStyles } from "./PhotoModal.styles";
import type { PhotoWithRelations } from "../types";

interface PhotoModalProps {
    visible: boolean;
    photos: PhotoWithRelations[];
    initialIndex: number;
    onClose: () => void;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const MODAL_WIDTH = SCREEN_WIDTH - spacing.sm * 2;
const DISMISS_DISTANCE = 110;

export default function PhotoModal({ visible, photos, initialIndex, onClose }: PhotoModalProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList<PhotoWithRelations>>(null);
    const translateY = useRef(new Animated.Value(0)).current;

    const safeInitialIndex = clampIndex(initialIndex, photos.length);
    const [activeIndex, setActiveIndex] = useState(safeInitialIndex);

    useEffect(() => {
        if (!visible) {
            translateY.setValue(0);
            return;
        }
        if (photos.length === 0) return;
        const nextIndex = clampIndex(initialIndex, photos.length);
        setActiveIndex(nextIndex);
        requestAnimationFrame(() => {
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: false });
        });
    }, [initialIndex, photos.length, translateY, visible]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, gestureState) => {
                    const dx = Math.abs(gestureState.dx);
                    const dy = Math.abs(gestureState.dy);
                    return dy > dx && dy > 8;
                },
                onPanResponderMove: (_, gestureState) => {
                    translateY.setValue(Math.max(0, gestureState.dy));
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (gestureState.dy > DISMISS_DISTANCE) {
                        Animated.timing(translateY, {
                            toValue: 400,
                            duration: 120,
                            useNativeDriver: true,
                        }).start(() => {
                            translateY.setValue(0);
                            onClose();
                        });
                        return;
                    }

                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 6,
                    }).start();
                },
            }),
        [onClose, translateY],
    );

    const activePhoto = photos[activeIndex];
    const displayCurrent = photos.length === 0 ? 0 : activeIndex + 1;
    const workoutTag = activePhoto?.workoutTag?.workoutTitle?.trim() || t("log.photosGalleryNoWorkoutTag");
    const noteText = activePhoto?.notes?.trim() || t("log.photosModalNoNotes");

    function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
        const nextIndex = Math.round(event.nativeEvent.contentOffset.x / MODAL_WIDTH);
        setActiveIndex(clampIndex(nextIndex, photos.length));
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            marginTop: insets.top + spacing.sm,
                            marginBottom: insets.bottom + spacing.sm,
                            transform: [{ translateY }],
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    <Pressable style={styles.content} onPress={() => { }}>
                        <View style={styles.header}>
                            <Text style={styles.counter}>
                                {t("log.photosModalCounter", { current: displayCurrent, total: photos.length })}
                            </Text>
                            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
                                <Ionicons name="close" size={22} color={colors.text} />
                            </Pressable>
                        </View>

                        <FlatList
                            ref={flatListRef}
                            data={photos}
                            keyExtractor={(item) => String(item.id)}
                            horizontal
                            pagingEnabled
                            bounces={false}
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={photos.length > 1}
                            style={styles.carousel}
                            initialNumToRender={1}
                            maxToRenderPerBatch={2}
                            windowSize={3}
                            getItemLayout={(_, index) => ({
                                length: MODAL_WIDTH,
                                offset: MODAL_WIDTH * index,
                                index,
                            })}
                            onMomentumScrollEnd={handleMomentumScrollEnd}
                            renderItem={({ item }) => (
                                <View style={[styles.imageSlide, { width: MODAL_WIDTH }]}> 
                                    {item.image_path ? (
                                        <Image
                                            source={{ uri: item.image_path }}
                                            style={styles.image}
                                            contentFit="cover"
                                            transition={120}
                                            cachePolicy="memory-disk"
                                        />
                                    ) : (
                                        <View style={styles.imageFallback}>
                                            <Text style={styles.imageFallbackText}>-</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        />

                        <View style={styles.metaSection}>
                            <Text style={styles.metaLabel}>{t("log.photosModalWorkoutLabel")}</Text>
                            <Text style={styles.metaValue}>{workoutTag}</Text>
                            <Text style={styles.metaLabel}>{t("log.photoDetailsNotesLabel")}</Text>
                            <Text style={styles.noteText}>{noteText}</Text>
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

function clampIndex(index: number, total: number) {
    if (total <= 0) return 0;
    return Math.min(Math.max(index, 0), total - 1);
}