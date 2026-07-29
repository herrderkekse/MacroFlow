import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

const SPRING_CONFIG = { damping: 130, stiffness: 2000 };
/** Slide/fade durations, in ms. */
const ENTER_MS = 260;
const EXIT_MS = 200;

interface SlideUpSheetProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

/**
 * A content-sized bottom sheet: it slides up from the bottom while the
 * backdrop fades in behind it, instead of the whole thing — darkening
 * included — travelling up together the way a plain sliding modal does.
 */
export default function SlideUpSheet({ visible, onClose, children }: SlideUpSheetProps) {
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    // The modal does not animate itself, so it has to stay mounted for the
    // length of the slide-out before it may disappear.
    const [lingering, setLingering] = React.useState(false);
    const [sheetHeight, setSheetHeight] = React.useState(0);

    const offset = useSharedValue(0);
    const backdropOpacity = useSharedValue(0);

    useEffect(() => {
        if (!visible) {
            backdropOpacity.value = withTiming(0, { duration: EXIT_MS });
            const timer = setTimeout(() => setLingering(false), EXIT_MS);
            return () => clearTimeout(timer);
        }
        backdropOpacity.value = withTiming(1, { duration: ENTER_MS });
        queueMicrotask(() => setLingering(true));
    }, [visible, backdropOpacity]);

    // Until the content has been measured the sheet is parked one screen's
    // worth down, so it can never flash in at full height.
    useEffect(() => {
        const hidden = sheetHeight || 1000;
        if (visible) {
            offset.value = withSpring(0, SPRING_CONFIG);
        } else {
            offset.value = withTiming(hidden, { duration: EXIT_MS });
        }
    }, [visible, sheetHeight, offset]);

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

    return (
        <Modal visible={visible || lingering} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <Pressable style={styles.fill} onPress={onClose} />
                </Animated.View>
                <Animated.View
                    style={[styles.sheet, sheetStyle]}
                    onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
                >
                    <View style={styles.grabber} />
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        root: { flex: 1, justifyContent: "flex-end" },
        fill: { flex: 1 },
        backdrop: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.42)",
        },
        sheet: {
            maxHeight: "90%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.lg + 6,
            borderTopRightRadius: borderRadius.lg + 6,
        },
        grabber: {
            alignSelf: "center",
            width: 38,
            height: 4,
            borderRadius: 999,
            backgroundColor: colors.border,
            marginTop: spacing.sm,
        },
    });
}
