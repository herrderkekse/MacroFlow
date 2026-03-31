import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { addEntry, getAllFoods, getAllRecipes, getGoals, getRecipeItems } from "@/src/db/queries";
import {
    buildMealPlanPrompt,
    getProvider,
    loadAiConfig,
    parseMealPlanResponse,
    parsePartialEntries,
} from "@/src/services/ai";
import type { AiFoodPayload, AiGoalsPayload, AiMealPlanEntry, AiRecipePayload, StreamStatus } from "@/src/services/ai/types";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MealPlanScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [likedFoods, setLikedFoods] = useState("");
    const [dislikedFoods, setDislikedFoods] = useState("");
    const [days, setDays] = useState("3");
    const [generating, setGenerating] = useState(false);
    const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
    const [result, setResult] = useState<AiMealPlanEntry[] | null>(null);
    const [importing, setImporting] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const statusLabel = useMemo(() => {
        switch (streamStatus) {
            case "connecting": return t("ai.statusConnecting");
            case "thinking": return t("ai.statusThinking");
            case "generating": return t("ai.statusGenerating");
            default: return t("ai.generating");
        }
    }, [streamStatus, t]);

    const handleCancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    async function handleGenerate() {
        const config = await loadAiConfig();
        if (!config || !config.apiKey) {
            Alert.alert(t("ai.mealPlan"), t("ai.configureFirst"));
            return;
        }

        const numDays = Math.max(1, Math.min(7, parseInt(days, 10) || 3));
        const goals = getGoals();
        if (!goals) {
            Alert.alert(t("ai.mealPlan"), t("ai.goalsRequired"));
            return;
        }

        const allFoods = getAllFoods();
        if (allFoods.length === 0) {
            Alert.alert(t("ai.mealPlan"), t("ai.noFoodsAvailable"));
            return;
        }

        const foodPayload: AiFoodPayload[] = allFoods.map((f) => ({
            id: f.id,
            name: f.name,
            calories_per_100g: f.calories_per_100g,
            protein_per_100g: f.protein_per_100g,
            carbs_per_100g: f.carbs_per_100g,
            fat_per_100g: f.fat_per_100g,
            default_unit: f.default_unit,
            serving_size: f.serving_size,
        }));

        const allRecipes = getAllRecipes();
        const recipePayload: AiRecipePayload[] = allRecipes.map((r) => {
            const items = getRecipeItems(r.id);
            return {
                id: r.id,
                name: r.name,
                items: items.map((i) => ({
                    food_id: i.recipe_items.food_id,
                    quantity_grams: i.recipe_items.quantity_grams,
                })),
            };
        });

        const goalsPayload: AiGoalsPayload = {
            calories: goals.calories,
            protein: goals.protein,
            carbs: goals.carbs,
            fat: goals.fat,
        };

        const abort = new AbortController();
        abortRef.current = abort;

        try {
            setGenerating(true);
            setStreamStatus(null);
            setResult(null);

            const messages = buildMealPlanPrompt(foodPayload, recipePayload, goalsPayload, {
                likedFoods,
                dislikedFoods,
                days: numDays,
            });

            const provider = getProvider(config.provider);
            const validIds = new Set(allFoods.map((f) => f.id));
            let raw: string;

            if (provider.supportsStreaming && provider.chatStream) {
                const response = await provider.chatStream(
                    config,
                    messages,
                    {
                        onStatus: (status) => setStreamStatus(status),
                        onToken: (accumulated) => {
                            // Extract complete entries from partial JSON as they stream in
                            const partial = parsePartialEntries(accumulated, validIds);
                            if (partial.length > 0) {
                                setResult(partial);
                            }
                        },
                    },
                    { signal: abort.signal },
                );
                raw = response.type === "text" ? response.content : "";
            } else {
                setStreamStatus("connecting");
                const response = await provider.chat(config, messages);
                raw = response.type === "text" ? response.content : "";
            }

            // Final parse with the complete response
            const plan = parseMealPlanResponse(raw, validIds, goalsPayload, foodPayload);
            setResult(plan.entries);
        } catch (e: any) {
            if (e.name === "AbortError") return;
            Alert.alert(t("ai.generationFailed"), e.message ?? t("common.unknownError"));
        } finally {
            setGenerating(false);
            setStreamStatus(null);
            abortRef.current = null;
        }
    }

    async function handleImport() {
        if (!result || result.length === 0) return;

        try {
            setImporting(true);
            const ts = Date.now();

            for (const entry of result) {
                addEntry({
                    food_id: entry.food_id,
                    quantity_grams: entry.quantity_grams,
                    quantity_unit: "g",
                    timestamp: ts,
                    date: entry.date,
                    meal_type: entry.meal_type,
                    is_scheduled: 1,
                });
            }

            Alert.alert(
                t("ai.mealPlan"),
                t("ai.importSuccess", { count: result.length }),
            );
            setResult(null);
        } catch (e: any) {
            Alert.alert(t("ai.importFailed"), e.message ?? t("common.unknownError"));
        } finally {
            setImporting(false);
        }
    }

    // Group results by date for display
    const grouped = useMemo(() => {
        if (!result) return null;
        const allFoods = getAllFoods();
        const foodMap = new Map(allFoods.map((f) => [f.id, f]));
        const map = new Map<string, (AiMealPlanEntry & { foodName: string; calories: number })[]>();
        for (const e of result) {
            const food = foodMap.get(e.food_id);
            const item = {
                ...e,
                foodName: food?.name ?? t("common.unknown"),
                calories: food ? Math.round(food.calories_per_100g * e.quantity_grams / 100) : 0,
            };
            const arr = map.get(e.date) ?? [];
            arr.push(item);
            map.set(e.date, arr);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [result, t]);

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.headerRow}>
                <Pressable onPress={() => router.navigate("/(tabs)/more" as any)} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </Pressable>
                <Text style={styles.heading}>{t("ai.mealPlan")}</Text>
            </View>

            <Text style={styles.sectionLabel}>{t("ai.preferences")}</Text>

            <Input
                label={t("ai.likedFoods")}
                value={likedFoods}
                onChangeText={setLikedFoods}
                placeholder={t("ai.likedFoodsPlaceholder")}
                containerStyle={styles.field}
            />

            <Input
                label={t("ai.dislikedFoods")}
                value={dislikedFoods}
                onChangeText={setDislikedFoods}
                placeholder={t("ai.dislikedFoodsPlaceholder")}
                containerStyle={styles.field}
            />

            <Input
                label={t("ai.planDays")}
                value={days}
                onChangeText={setDays}
                keyboardType="number-pad"
                containerStyle={styles.field}
                suffix={t("ai.days")}
            />

            <Button
                title={generating ? t("ai.generating") : t("ai.generatePlan")}
                onPress={handleGenerate}
                loading={generating}
                disabled={generating}
                style={styles.generateBtn}
            />

            {/* Streaming status indicator */}
            {generating && streamStatus && (
                <View style={styles.statusRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.statusText}>{statusLabel}</Text>
                    <Pressable onPress={handleCancel} hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </Pressable>
                </View>
            )}

            {/* Non-streaming hint */}
            {generating && !streamStatus && (
                <View style={styles.statusRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.statusText}>{t("ai.noStreamingHint")}</Text>
                </View>
            )}

            {/* Results preview */}
            {grouped && grouped.length > 0 && (
                <>
                    <Text style={styles.sectionLabel}>{t("ai.planPreview")}</Text>
                    {grouped.map(([date, entries]) => (
                        <View key={date} style={styles.dayCard}>
                            <Text style={styles.dayHeading}>{date}</Text>
                            {entries.map((entry, i) => (
                                <View key={`${entry.food_id}-${i}`} style={styles.entryRow}>
                                    <Text style={styles.mealBadge}>{t(`meal.${entry.meal_type}`)}</Text>
                                    <Text style={styles.entryFood} numberOfLines={1}>{entry.foodName}</Text>
                                    <Text style={styles.entryDetail}>
                                        {Math.round(entry.quantity_grams)}g · {entry.calories} {t("common.kcal")}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ))}

                    <Button
                        title={t("ai.importPlan")}
                        onPress={handleImport}
                        loading={importing}
                        disabled={generating}
                        style={styles.importBtn}
                    />
                </>
            )}
        </ScrollView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: 100 },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        backBtn: { padding: 4 },
        heading: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
        },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.md,
        },
        field: { marginBottom: spacing.md },
        generateBtn: { marginTop: spacing.sm },
        statusRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.md,
            paddingHorizontal: spacing.sm,
        },
        statusText: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        dayCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginBottom: spacing.sm,
        },
        dayHeading: {
            fontSize: fontSize.md,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.sm,
        },
        entryRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.xs,
        },
        mealBadge: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.primary,
            width: 70,
        },
        entryFood: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.text,
        },
        entryDetail: {
            fontSize: fontSize.xs,
            color: colors.textSecondary,
        },
        importBtn: { marginTop: spacing.md },
    });
}
