// Landing screen for share deep links (macroflow://share/<token>?origin=…).
// Fetches the shared payload and offers Cancel / Save to library / Save and
// add to log. Rendered as a floating card so it reads as a modal even though
// it is a pushed route (deep links may open the app cold, with no screen
// underneath to overlay).

import Button from "@/src/shared/atoms/Button";
import CalendarPicker from "@/src/shared/components/CalendarPicker";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { MEAL_TYPES, type MealType } from "@/src/shared/types";
import { formatDateKey } from "@/src/utils/date";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SharePreview from "../components/SharePreview";
import type { FetchedShare } from "../services/shareClient";
import {
    importFoodPayload,
    importLogPayloadToLibrary,
    importLogPayloadToLog,
    importRecipePayload,
    logImportedFood,
    logImportedRecipe,
    type FoodSharePayload,
    type LogSharePayload,
    type RecipeSharePayload,
} from "../services/sharePayloads";
import { fetchSharedContent } from "../services/shareService";

type LoadState =
    | { status: "loading" }
    | { status: "ready"; share: FetchedShare }
    | { status: "error"; message: string };

export default function ImportScreen() {
    const { token, origin } = useLocalSearchParams<{ token: string; origin?: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [state, setState] = useState<LoadState>({ status: "loading" });
    const [saving, setSaving] = useState(false);
    const [targetDate, setTargetDate] = useState(new Date());
    const [mealType, setMealType] = useState<MealType>("snack");
    const [calendarVisible, setCalendarVisible] = useState(false);

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) setState({ status: "loading" });
        });
        fetchSharedContent(String(token ?? ""), origin)
            .then((share) => {
                if (cancelled) return;
                if (share.kind !== "food" && share.kind !== "recipe" && share.kind !== "log") {
                    setState({ status: "error", message: t("share.importUnsupported") });
                    return;
                }
                setState({ status: "ready", share });
            })
            .catch((e: any) => {
                if (!cancelled) {
                    setState({ status: "error", message: e?.message ?? t("common.unknownError") });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [token, origin, t]);

    function close() {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)" as any);
    }

    function finish(message: string) {
        Alert.alert(t("share.importTitle"), message, [{ text: t("common.ok"), onPress: close }]);
    }

    function handleSaveToLibrary() {
        if (state.status !== "ready") return;
        try {
            setSaving(true);
            const { kind, payload } = state.share;
            if (kind === "food") importFoodPayload(payload as FoodSharePayload);
            else if (kind === "recipe") importRecipePayload(payload as RecipeSharePayload);
            else importLogPayloadToLibrary(payload as LogSharePayload);
            finish(t("share.importSavedToLibrary"));
        } catch (e: any) {
            Alert.alert(t("share.importFailed"), e?.message ?? t("common.unknownError"));
        } finally {
            setSaving(false);
        }
    }

    function handleSaveAndLog() {
        if (state.status !== "ready") return;
        try {
            setSaving(true);
            const { kind, payload } = state.share;
            const dateKey = formatDateKey(targetDate);
            if (kind === "food") {
                logImportedFood(importFoodPayload(payload as FoodSharePayload), dateKey, mealType);
            } else if (kind === "recipe") {
                logImportedRecipe(importRecipePayload(payload as RecipeSharePayload), dateKey, mealType);
            } else {
                importLogPayloadToLog(payload as LogSharePayload, dateKey);
            }
            finish(t("share.importSavedAndLogged"));
        } catch (e: any) {
            Alert.alert(t("share.importFailed"), e?.message ?? t("common.unknownError"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <Text style={styles.title}>{t("share.importTitle")}</Text>
                    <Pressable onPress={close} hitSlop={8}>
                        <Ionicons name="close" size={22} color={colors.textSecondary} />
                    </Pressable>
                </View>

                {state.status === "loading" && (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.statusText}>{t("share.importLoading")}</Text>
                    </View>
                )}

                {state.status === "error" && (
                    <View style={styles.center}>
                        <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
                        <Text style={styles.errorText}>{state.message}</Text>
                        <Button title={t("common.cancel")} variant="outline" onPress={close} style={styles.errorBtn} />
                    </View>
                )}

                {state.status === "ready" && (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <SharePreview share={state.share} colors={colors} />

                        {/* Date (all kinds) + meal (templates only; log items keep their own meals). */}
                        <Text style={styles.sectionLabel}>{t("share.logOnDate")}</Text>
                        <Pressable style={styles.dateRow} onPress={() => setCalendarVisible(true)}>
                            <Text style={styles.dateText}>
                                {targetDate.toLocaleDateString(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </Text>
                            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                        </Pressable>

                        {state.share.kind !== "log" && (
                            <>
                                <Text style={styles.sectionLabel}>{t("share.logToMeal")}</Text>
                                <View style={styles.mealOptions}>
                                    {MEAL_TYPES.map((meal) => (
                                        <Pressable
                                            key={meal.key}
                                            style={[
                                                styles.mealOption,
                                                mealType === meal.key && styles.mealOptionSelected,
                                            ]}
                                            onPress={() => setMealType(meal.key)}
                                        >
                                            <Ionicons
                                                name={meal.icon as never}
                                                size={16}
                                                color={mealType === meal.key ? "#fff" : colors.text}
                                            />
                                            <Text
                                                style={[
                                                    styles.mealOptionText,
                                                    mealType === meal.key && styles.mealOptionTextSelected,
                                                ]}
                                            >
                                                {t(`meal.${meal.key}`)}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </>
                        )}

                        <Button
                            title={t("share.saveAndLog")}
                            onPress={handleSaveAndLog}
                            loading={saving}
                            style={styles.actionBtn}
                        />
                        <Button
                            title={t("share.saveToLibrary")}
                            variant="outline"
                            onPress={handleSaveToLibrary}
                            disabled={saving}
                            style={styles.actionBtn}
                        />
                        <Button
                            title={t("common.cancel")}
                            variant="ghost"
                            onPress={close}
                            disabled={saving}
                            style={styles.actionBtn}
                        />
                    </ScrollView>
                )}
            </View>

            <CalendarPicker
                visible={calendarVisible}
                selectedDate={targetDate}
                onSelect={(date) => {
                    setTargetDate(date);
                    setCalendarVisible(false);
                }}
                onClose={() => setCalendarVisible(false)}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: colors.background,
            padding: spacing.lg,
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            maxHeight: "90%",
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
        },
        center: {
            alignItems: "center",
            paddingVertical: spacing.xl,
        },
        statusText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginTop: spacing.md,
            textAlign: "center",
        },
        errorText: {
            fontSize: fontSize.sm,
            color: colors.danger,
            marginTop: spacing.md,
            textAlign: "center",
        },
        errorBtn: { marginTop: spacing.md },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.sm,
        },
        dateRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.background,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            marginBottom: spacing.sm,
        },
        dateText: {
            fontSize: fontSize.md,
            color: colors.text,
            fontWeight: "500",
        },
        mealOptions: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        mealOption: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        mealOptionSelected: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        mealOptionText: {
            fontSize: fontSize.sm,
            color: colors.text,
        },
        mealOptionTextSelected: {
            color: "#fff",
            fontWeight: "600",
        },
        actionBtn: { marginTop: spacing.sm },
    });
}
