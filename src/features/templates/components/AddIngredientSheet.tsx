import { isObsolete, productNutrition, type OFFProduct } from "@/src/services/openfoodfacts";
import Button from "@/src/shared/atoms/Button";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
    useAnimatedKeyboard,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Food } from "../services/templateDb";

const SPRING_CONFIG = { damping: 130, stiffness: 2000 };
/** The two taller sheet heights, as a share of the window. */
const MIDDLE_FRACTION = 0.7;
const TALLEST_FRACTION = 0.92;
/** How much of the results list the shortest sheet keeps in view. */
const RESULT_GLIMPSE = 96;
/** Shortest sheet before the header has been measured. */
const FALLBACK_SHORTEST_FRACTION = 0.45;
/** The shortest sheet never grows past this share of the window. */
const MAX_SHORTEST_FRACTION = 0.6;
/** The sheet opens at the middle height. */
const DEFAULT_SNAP = 1;
/** Past this speed the release counts as a flick to the next height. */
const FLICK_VELOCITY = 700;
/** Slide/fade durations, in ms. */
const ENTER_MS = 260;
const EXIT_MS = 200;

interface AddIngredientSheetProps {
    visible: boolean;
    onClose: () => void;
    query: string;
    onChangeQuery: (value: string) => void;
    localResults: Food[];
    offResults: OFFProduct[];
    isSearchingOFF: boolean;
    hasSearchedOFF: boolean;
    offError: string | null;
    onSearchOFF: () => void;
    onSelectLocal: (food: Food) => void;
    onSelectOFF: (product: OFFProduct) => void;
    onScan: () => void;
    onCreateNew: () => void;
}

/** Bottom sheet for finding the next ingredient: on-device, barcode, or OFF. */
export default function AddIngredientSheet({
    visible,
    onClose,
    query,
    onChangeQuery,
    localResults,
    offResults,
    isSearchingOFF,
    hasSearchedOFF,
    offError,
    onSearchOFF,
    onSelectLocal,
    onSelectOFF,
    onScan,
    onCreateNew,
}: AddIngredientSheetProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { height: windowHeight } = useWindowDimensions();

    // The modal itself no longer animates, so it has to stay mounted for the
    // length of the slide-out before it may disappear.
    const [lingering, setLingering] = React.useState(false);

    // Height of everything above the results (handle, title, search, actions),
    // measured so the shortest snap point can show exactly one result.
    const [chromeHeight, setChromeHeight] = React.useState(0);

    // The sheet is always as tall as the largest snap point and is slid down
    // to reach the smaller ones, so its height never depends on the results.
    const snapPoints = useMemo(() => {
        const shortest = chromeHeight > 0
            ? Math.min(
                  Math.round(chromeHeight + RESULT_GLIMPSE + insets.bottom),
                  Math.round(windowHeight * MAX_SHORTEST_FRACTION),
              )
            : Math.round(windowHeight * FALLBACK_SHORTEST_FRACTION);
        return [
            shortest,
            Math.round(windowHeight * MIDDLE_FRACTION),
            Math.round(windowHeight * TALLEST_FRACTION),
        ];
    }, [chromeHeight, windowHeight, insets.bottom]);
    const sheetHeight = snapPoints[snapPoints.length - 1];

    // The resting height, plus whether the sheet was raised off the shortest
    // height by the keyboard (only then does it drop back afterwards).
    // `animate` marks changes the sheet still has to move for — a drag has
    // already moved it by the time it reports back.
    const [snap, setSnap] = React.useState({
        index: DEFAULT_SNAP,
        raisedByKeyboard: false,
        animate: false,
    });

    // Starts off-screen so the first open slides in.
    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);
    const dragStartY = useSharedValue(0);

    const settleAt = useCallback((index: number) => {
        // Dragging down to the shortest height puts the search field behind the
        // keyboard, so let it go.
        if (index === 0) Keyboard.dismiss();
        setSnap({ index, raisedByKeyboard: false, animate: false });
    }, []);

    const dragHandle = Gesture.Pan()
        .onStart(() => {
            "worklet";
            dragStartY.value = translateY.value;
        })
        .onUpdate((e) => {
            "worklet";
            const lowest = sheetHeight - snapPoints[0];
            translateY.value = Math.max(0, Math.min(dragStartY.value + e.translationY, lowest));
        })
        .onEnd((e) => {
            "worklet";
            let nearest = 0;
            let bestDistance = Number.MAX_VALUE;
            for (let i = 0; i < snapPoints.length; i++) {
                const distance = Math.abs(translateY.value - (sheetHeight - snapPoints[i]));
                if (distance < bestDistance) {
                    bestDistance = distance;
                    nearest = i;
                }
            }
            // A flick moves one height at a time (down is a positive velocity
            // but a smaller sheet), so it can never skip the middle.
            let target = nearest;
            if (Math.abs(e.velocityY) > FLICK_VELOCITY) {
                target = e.velocityY > 0 ? nearest - 1 : nearest + 1;
                target = Math.max(0, Math.min(snapPoints.length - 1, target));
            }
            translateY.value = withSpring(sheetHeight - snapPoints[target], SPRING_CONFIG);
            scheduleOnRN(settleAt, target);
        });

    // The backdrop fades on its own rather than travelling up with the sheet.
    // Opening also resets the height, so a session that was dragged down does
    // not leave the next one short.
    useEffect(() => {
        if (!visible) {
            backdropOpacity.value = withTiming(0, { duration: EXIT_MS });
            const timer = setTimeout(() => setLingering(false), EXIT_MS);
            return () => clearTimeout(timer);
        }
        backdropOpacity.value = withTiming(1, { duration: ENTER_MS });
        queueMicrotask(() => {
            setLingering(true);
            setSnap({ index: DEFAULT_SNAP, raisedByKeyboard: false, animate: true });
        });
    }, [visible, backdropOpacity]);

    // Neither platform resizes the window for the keyboard (Android is in
    // "pan" mode), so the shortest height would leave the search field behind
    // it. Rise to the default height instead, and drop back on dismissal.
    useEffect(() => {
        if (!visible) return;
        const shown = Keyboard.addListener("keyboardDidShow", () => {
            setSnap((current) =>
                current.index === 0
                    ? { index: DEFAULT_SNAP, raisedByKeyboard: true, animate: true }
                    : current,
            );
        });
        const hidden = Keyboard.addListener("keyboardDidHide", () => {
            setSnap((current) =>
                current.raisedByKeyboard
                    ? { index: 0, raisedByKeyboard: false, animate: true }
                    : current,
            );
        });
        return () => {
            shown.remove();
            hidden.remove();
        };
    }, [visible]);

    // Moves the sheet to whatever height was settled on. A drag has already
    // moved it by the time it reports back, hence the `animate` flag.
    useEffect(() => {
        if (!visible) {
            translateY.value = withTiming(sheetHeight, { duration: EXIT_MS });
        } else if (snap.animate) {
            translateY.value = withSpring(sheetHeight - snapPoints[snap.index], SPRING_CONFIG);
        }
    }, [visible, snap, sheetHeight, snapPoints, translateY]);

    const keyboard = useAnimatedKeyboard();
    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
    const bottomPadding = insets.bottom + spacing.lg;
    // What hangs below the visible area: the sheet's own overhang plus the
    // keyboard, so the last result can always be scrolled into view.
    const tailSpacerStyle = useAnimatedStyle(() => ({
        height: translateY.value + keyboard.height.value + bottomPadding,
    }));

    const trimmed = query.trim();
    const canSearchOFF = trimmed.length >= 2;
    const noLocalResults = canSearchOFF && localResults.length === 0;

    return (
        <Modal visible={visible || lingering} transparent animationType="none" onRequestClose={onClose}>
            {/* A Modal is its own view hierarchy, so gestures inside it need
                their own gesture root. */}
            <GestureHandlerRootView style={styles.flex}>
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <Pressable style={styles.flex} onPress={onClose} />
                </Animated.View>
                <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
                    <View onLayout={(e) => setChromeHeight(e.nativeEvent.layout.height)}>
                        <GestureDetector gesture={dragHandle}>
                            <Animated.View style={styles.handleArea}>
                                <View style={styles.grabber} />
                            </Animated.View>
                        </GestureDetector>

                        <View style={styles.header}>
                            <View style={styles.titleRow}>
                                <Text style={styles.title}>{t("templates.addIngredient")}</Text>
                                <Pressable onPress={onClose} hitSlop={8}>
                                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                                </Pressable>
                            </View>

                            <View style={styles.searchRow}>
                                <Ionicons name="search" size={17} color={colors.textTertiary} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={t("templates.searchFoods")}
                                    placeholderTextColor={colors.textTertiary}
                                    value={query}
                                    onChangeText={onChangeQuery}
                                    autoFocus
                                    returnKeyType="search"
                                />
                                {query.length > 0 && (
                                    <Pressable onPress={() => onChangeQuery("")} hitSlop={8}>
                                        <Ionicons name="close-circle" size={17} color={colors.textTertiary} />
                                    </Pressable>
                                )}
                                {canSearchOFF && !hasSearchedOFF && (
                                    <>
                                        <View style={styles.divider} />
                                        <Pressable onPress={onSearchOFF} hitSlop={8} disabled={isSearchingOFF}>
                                            <Ionicons
                                                name="globe-outline"
                                                size={19}
                                                color={colors.primary}
                                                style={isSearchingOFF ? styles.dimmed : undefined}
                                            />
                                        </Pressable>
                                    </>
                                )}
                            </View>

                            <View style={styles.actionRow}>
                                <Button
                                    title={t("log.scanBarcode")}
                                    variant="outline"
                                    icon={<Ionicons name="barcode-outline" size={18} color={colors.primary} />}
                                    onPress={onScan}
                                    style={styles.actionBtn}
                                    textStyle={styles.actionBtnText}
                                />
                                <Button
                                    title={t("log.createNew")}
                                    variant="outline"
                                    icon={<Ionicons name="create-outline" size={17} color={colors.primary} />}
                                    onPress={onCreateNew}
                                    style={styles.actionBtn}
                                    textStyle={styles.actionBtnText}
                                />
                            </View>
                        </View>
                    </View>

                    <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                        {offError && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{offError}</Text>
                                <Button
                                    title={t("common.retry")}
                                    variant="ghost"
                                    onPress={onSearchOFF}
                                    textStyle={styles.actionBtnText}
                                />
                            </View>
                        )}

                        {localResults.length > 0 && (
                            <>
                                <Text style={styles.groupLabel}>{t("templates.onDeviceResults")}</Text>
                                {localResults.map((food) => (
                                    <ResultRow
                                        key={food.id}
                                        name={food.name}
                                        hint={t("templates.calPer100g", { cal: Math.round(food.calories_per_100g) })}
                                        onPress={() => onSelectLocal(food)}
                                        styles={styles}
                                        colors={colors}
                                    />
                                ))}
                            </>
                        )}

                        {noLocalResults && !isSearchingOFF && (
                            <View style={styles.emptyState}>
                                <Ionicons name="help-circle-outline" size={28} color={colors.textTertiary} />
                                <Text style={styles.emptyTitle}>{t("templates.noSavedFood", { query: trimmed })}</Text>
                                <Text style={styles.emptyBody}>{t("templates.noSavedFoodHint")}</Text>
                            </View>
                        )}

                        {!canSearchOFF && (
                            <Text style={styles.emptyBody}>{t("templates.searchPrompt")}</Text>
                        )}

                        {isSearchingOFF && (
                            <ActivityIndicator color={colors.primary} style={styles.spinner} />
                        )}

                        {offResults.length > 0 && (
                            <>
                                <Text style={styles.groupLabel}>{t("log.sectionOpenFoodFacts")}</Text>
                                {offResults.map((product) => {
                                    // The search index carries only the as-sold
                                    // per-100 g figures, so this preview can fall
                                    // short of the hydrated import.
                                    const nutrition = productNutrition(product);
                                    return (
                                        <ResultRow
                                            key={product.code}
                                            name={product.product_name || t("common.unknown")}
                                            hint={
                                                nutrition
                                                    ? t("templates.calPer100g", {
                                                          cal: Math.round(nutrition.calories_per_100g),
                                                      })
                                                    : t("common.offNoNutrition")
                                            }
                                            warning={isObsolete(product) ? t("common.offObsolete") : undefined}
                                            onPress={() => onSelectOFF(product)}
                                            styles={styles}
                                            colors={colors}
                                        />
                                    );
                                })}
                            </>
                        )}

                        {hasSearchedOFF && offResults.length === 0 && !offError && (
                            <Text style={styles.emptyBody}>{t("common.noOnlineResults")}</Text>
                        )}
                        {/* The sheet is taller than its snap point, so the
                            part hanging below the screen has to be scrolled
                            past to reach the last result. */}
                        <Animated.View style={tailSpacerStyle} />
                    </ScrollView>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

interface ResultRowProps {
    name: string;
    hint: string;
    /** Caveat about the item itself, e.g. an OFF product that was delisted. */
    warning?: string;
    onPress: () => void;
    styles: ReturnType<typeof createStyles>;
    colors: ThemeColors;
}

function ResultRow({ name, hint, warning, onPress, styles, colors }: ResultRowProps) {
    return (
        <Pressable onPress={onPress} style={styles.resultRow}>
            <View style={styles.resultMain}>
                <Text style={styles.resultName} numberOfLines={1}>{name}</Text>
                <Text style={styles.resultHint}>{hint}</Text>
                {warning && (
                    <View style={styles.resultWarning}>
                        <Ionicons name="warning-outline" size={12} color={colors.warning} />
                        <Text style={styles.resultWarningText}>{warning}</Text>
                    </View>
                )}
            </View>
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1 },
        backdrop: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.42)",
        },
        sheet: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.lg + 6,
            borderTopRightRadius: borderRadius.lg + 6,
        },
        // The grabber is thin, so the area around it carries the touch target.
        handleArea: { alignItems: "center", paddingVertical: spacing.md },
        grabber: {
            width: 38,
            height: 4,
            borderRadius: 999,
            backgroundColor: colors.border,
        },
        header: {
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
        },
        title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
        searchRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.background,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 3,
        },
        searchInput: { flex: 1, fontSize: fontSize.md, color: colors.text, padding: 0 },
        divider: { width: 1, height: 18, backgroundColor: colors.border },
        dimmed: { opacity: 0.45 },
        actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
        actionBtn: { flex: 1 },
        actionBtnText: { fontSize: fontSize.sm },
        results: { flex: 1, paddingHorizontal: spacing.md },
        groupLabel: {
            fontSize: fontSize.xs,
            fontWeight: "700",
            letterSpacing: 0.6,
            color: colors.textTertiary,
            textTransform: "uppercase",
            marginTop: spacing.md,
            marginBottom: spacing.xs,
        },
        resultRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.sm + 3,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        resultMain: { flex: 1 },
        resultName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        resultHint: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
        resultWarning: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
        resultWarningText: { fontSize: fontSize.xs, color: colors.warning },
        emptyState: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.lg },
        emptyTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, textAlign: "center" },
        emptyBody: {
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            textAlign: "center",
            lineHeight: 18,
            maxWidth: 260,
            alignSelf: "center",
            paddingVertical: spacing.md,
        },
        spinner: { marginVertical: spacing.md },
        errorBox: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.background,
            borderRadius: borderRadius.sm,
            padding: spacing.sm,
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: colors.danger,
        },
        errorText: { flex: 1, fontSize: fontSize.sm, color: colors.danger },
    });
}
