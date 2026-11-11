import { isObsolete, productName, productNutrition, type OFFProduct } from "@/src/services/openfoodfacts";
import Button from "@/src/shared/atoms/Button";
import Chip from "@/src/shared/atoms/Chip";
import EmptyState from "@/src/shared/atoms/EmptyState";
import IconButton from "@/src/shared/atoms/IconButton";
import Notice from "@/src/shared/atoms/Notice";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import FoodRow from "@/src/shared/components/FoodRow";
import SearchBar from "@/src/shared/components/SearchBar";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
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
                                <IconButton icon="close" label={t("common.close")} onPress={onClose} variant="tonal" size="sm" />
                            </View>

                            <SearchBar
                                value={query}
                                onChangeText={onChangeQuery}
                                placeholder={t("templates.searchFoods")}
                                autoFocus
                                trailing={
                                    canSearchOFF && !hasSearchedOFF ? (
                                        <IconButton
                                            icon="globe-outline"
                                            size="sm"
                                            label={t("log.searchOnline")}
                                            onPress={onSearchOFF}
                                            disabled={isSearchingOFF}
                                        />
                                    ) : undefined
                                }
                            />

                            <View style={styles.actionRow}>
                                <Chip label={t("log.scanBarcode")} icon="barcode-outline" onPress={onScan} />
                                <Chip label={t("log.createNew")} icon="create-outline" onPress={onCreateNew} />
                            </View>
                        </View>
                    </View>

                    <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                        {offError && (
                            <Notice
                                tone="danger"
                                style={styles.error}
                                action={<Button title={t("common.retry")} variant="ghost" size="sm" onPress={onSearchOFF} />}
                            >
                                {offError}
                            </Notice>
                        )}

                        {localResults.length > 0 && (
                            <>
                                <SectionLabel style={styles.groupLabel}>{t("templates.onDeviceResults")}</SectionLabel>
                                {localResults.map((food) => (
                                    <FoodRow
                                        key={food.id}
                                        name={food.name}
                                        nutrition={{
                                            calories: food.calories_per_100g,
                                            protein: food.protein_per_100g,
                                            carbs: food.carbs_per_100g,
                                            fat: food.fat_per_100g,
                                        }}
                                        onPress={() => onSelectLocal(food)}
                                    />
                                ))}
                            </>
                        )}

                        {noLocalResults && !isSearchingOFF && (
                            <EmptyState
                                icon="help-circle-outline"
                                title={t("templates.noSavedFood", { query: trimmed })}
                                message={t("templates.noSavedFoodHint")}
                            />
                        )}

                        {!canSearchOFF && <EmptyState title={t("templates.searchPrompt")} />}

                        {isSearchingOFF && (
                            <ActivityIndicator color={colors.textSecondary} style={styles.spinner} />
                        )}

                        {offResults.length > 0 && (
                            <>
                                <SectionLabel style={styles.groupLabel}>{t("log.sectionOpenFoodFacts")}</SectionLabel>
                                {offResults.map((product) => {
                                    // The search index carries only the as-sold
                                    // per-100 g figures, so this preview can fall
                                    // short of the hydrated import.
                                    const nutrition = productNutrition(product);
                                    return (
                                        <FoodRow
                                            key={product.code}
                                            name={productName(product, t("common.unknown"))}
                                            nutrition={
                                                nutrition && {
                                                    calories: nutrition.calories_per_100g,
                                                    protein: nutrition.protein_per_100g,
                                                    carbs: nutrition.carbs_per_100g,
                                                    fat: nutrition.fat_per_100g,
                                                }
                                            }
                                            warning={isObsolete(product) ? t("common.offObsolete") : undefined}
                                            isOnline
                                            onPress={() => onSelectOFF(product)}
                                        />
                                    );
                                })}
                            </>
                        )}

                        {hasSearchedOFF && offResults.length === 0 && !offError && (
                            <EmptyState title={t("common.noOnlineResults")} />
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

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1 },
        backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
        sheet: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
        },
        // The grabber is thin, so the area around it carries the touch target.
        handleArea: { alignItems: "center", paddingTop: spacing.sm + 2, paddingBottom: spacing.sm },
        grabber: { width: 36, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.borderStrong },
        header: {
            paddingHorizontal: screenPadding,
            paddingBottom: spacing.sm + 4,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: spacing.xs,
            marginBottom: spacing.sm + 4,
        },
        title: { fontSize: fontSize.lg, fontWeight: "700", letterSpacing: -0.2, color: colors.text },
        actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm + 4 },
        results: { flex: 1 },
        groupLabel: { marginTop: spacing.md, marginBottom: 0, paddingHorizontal: screenPadding },
        spinner: { marginVertical: spacing.md },
        error: { marginTop: spacing.md, marginHorizontal: screenPadding },
    });
}
