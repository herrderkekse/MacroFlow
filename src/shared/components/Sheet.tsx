import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

const SPRING_CONFIG = { damping: 130, stiffness: 2000 };
const ENTER_MS = 240;
const EXIT_MS = 180;
/** Dragging the sheet further down than this, or flicking it, dismisses it. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 800;
/** Share of the window a sheet may cover. */
const MAX_HEIGHT_FRACTION = 0.9;

interface SheetProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    /** Action shown next to the close button (e.g. a secondary icon button). */
    headerRight?: React.ReactNode;
    children: React.ReactNode;
    /** Pinned under the content: the sheet's main action(s). */
    footer?: React.ReactNode;
    /** Content scrolls when it outgrows the sheet (default). Turn off for own lists. */
    scrollable?: boolean;
    /** Always use the full sheet height — for search and long lists. */
    tall?: boolean;
    /** Horizontal/vertical padding around the content (default true). */
    padded?: boolean;
}

/**
 * The one bottom sheet. Use it for anything done *in the context of* the
 * current screen: editing a single value, picking from a short list, a menu
 * of actions, a share dialog. It slides up over a fading scrim, and is
 * dismissed by the scrim, the close button, the back button or a drag down.
 */
export default function Sheet(props: SheetProps) {
    const { visible, onClose } = props;
    // The modal does not animate itself, so it stays mounted for the length
    // of the slide-out before it may disappear.
    const [lingering, setLingering] = useState(false);

    useEffect(() => {
        if (visible) {
            queueMicrotask(() => setLingering(true));
            return;
        }
        const timer = setTimeout(() => setLingering(false), EXIT_MS);
        return () => clearTimeout(timer);
    }, [visible]);

    const isMounted = visible || lingering;

    return (
        <Modal
            visible={isMounted}
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={onClose}
        >
            {isMounted && <SheetBody {...props} />}
        </Modal>
    );
}

function SheetBody({
    visible,
    onClose,
    title,
    subtitle,
    headerRight,
    children,
    footer,
    scrollable = true,
    tall = false,
    padded = true,
}: SheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const maxHeight = Math.round((windowHeight - insets.top) * MAX_HEIGHT_FRACTION);

    // Starts one window down, so the first frame is already off-screen.
    const offset = useSharedValue(windowHeight);
    const backdropOpacity = useSharedValue(0);
    const dragStart = useSharedValue(0);

    const drag = Gesture.Pan()
        .onStart(() => {
            "worklet";
            dragStart.value = offset.value;
        })
        .onUpdate((e) => {
            "worklet";
            offset.value = Math.max(0, dragStart.value + e.translationY);
        })
        .onEnd((e) => {
            "worklet";
            if (offset.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
                scheduleOnRN(onClose);
            } else {
                offset.value = withSpring(0, SPRING_CONFIG);
            }
        });

    // Declared after the gesture: the gesture writes `offset`, and a shared value
    // may not be written once an effect has captured it.
    useEffect(() => {
        if (visible) {
            offset.value = withSpring(0, SPRING_CONFIG);
            backdropOpacity.value = withTiming(1, { duration: ENTER_MS });
        } else {
            offset.value = withTiming(windowHeight, { duration: EXIT_MS });
            backdropOpacity.value = withTiming(0, { duration: EXIT_MS });
        }
    }, [visible, offset, backdropOpacity, windowHeight]);

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

    const contentStyle = [padded && styles.padded, !footer && { paddingBottom: insets.bottom + spacing.md }];

    return (
        // A Modal is its own view hierarchy, so gestures inside it need their
        // own gesture root.
        <GestureHandlerRootView style={styles.root}>
            <Animated.View style={[styles.backdrop, backdropStyle]}>
                <Pressable style={styles.fill} onPress={onClose} accessibilityLabel={t("common.close")} />
            </Animated.View>
            <Animated.View style={[styles.sheet, { maxHeight }, tall && { height: maxHeight }, sheetStyle]}>
                <GestureDetector gesture={drag}>
                    <Animated.View>
                        <View style={styles.grabberArea}>
                            <View style={styles.grabber} />
                        </View>
                        {title ? (
                            <View style={styles.header}>
                                <View style={styles.titleBlock}>
                                    <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                                        {title}
                                    </Text>
                                    {subtitle ? (
                                        <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
                                    ) : null}
                                </View>
                                {headerRight}
                                <IconButton icon="close" label={t("common.close")} onPress={onClose} variant="tonal" size="sm" />
                            </View>
                        ) : null}
                    </Animated.View>
                </GestureDetector>

                {scrollable ? (
                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={contentStyle}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {children}
                    </ScrollView>
                ) : (
                    <View style={[styles.scroll, tall && styles.fill, contentStyle]}>{children}</View>
                )}

                {footer ? (
                    <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View>
                ) : null}
            </Animated.View>
        </GestureHandlerRootView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        root: { flex: 1, justifyContent: "flex-end" },
        fill: { flex: 1 },
        backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
        sheet: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            overflow: "hidden",
        },
        // The grabber is thin, so the area around it carries the touch target.
        grabberArea: { alignItems: "center", paddingTop: spacing.sm + 2, paddingBottom: spacing.sm },
        grabber: { width: 36, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.borderStrong },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: screenPadding,
            paddingTop: spacing.xs,
            paddingBottom: spacing.sm + 4,
        },
        titleBlock: { flex: 1 },
        title: { fontSize: fontSize.lg, fontWeight: "700", letterSpacing: -0.2, color: colors.text },
        subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
        scroll: { flexShrink: 1 },
        padded: { paddingHorizontal: screenPadding, paddingTop: spacing.xs },
        footer: {
            paddingHorizontal: screenPadding,
            paddingTop: spacing.sm + 4,
            gap: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
    });
}
