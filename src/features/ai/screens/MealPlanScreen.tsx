import { addEntry } from "@/src/features/log/services/logDb";
import { getGoals } from "@/src/features/settings/services/settingsDb";
import { formatRecipeName } from "@/src/features/templates/services/recipeVariantsDb";
import { getAllFoods, getAllRecipes, getRecipeItems } from "@/src/features/templates/services/templateDb";
import Button from "@/src/shared/atoms/Button";
import Card from "@/src/shared/atoms/Card";
import IconButton from "@/src/shared/atoms/IconButton";
import Input from "@/src/shared/atoms/Input";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadAiConfig } from "../services/aiConfig";
import { generateMealPlan } from "../services/mealPlanService";
import type { AiFoodPayload, AiGoalsPayload, AiMealPlanEntry, AiRecipePayload, StreamStatus } from "../types/types";

export default function MealPlanScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

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
            case "refining": return t("ai.statusRefining");
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
                name: formatRecipeName(r),
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

            const validIds = new Set(allFoods.map((f) => f.id));

            const plan = await generateMealPlan({
                config,
                foods: foodPayload,
                recipes: recipePayload,
                goals: goalsPayload,
                prefs: { likedFoods, dislikedFoods, days: numDays },
                validFoodIds: validIds,
                onStatus: (status) => setStreamStatus(status),
                onPartialEntries: (entries) => setResult(entries),
                signal: abort.signal,
            });

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

    const hasPlan = !!grouped && grouped.length > 0;

    return (
        <View style={styles.screen}>
            <ScreenHeader title={t("more.mealPlan")} />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <SectionLabel style={styles.firstLabel}>{t("ai.preferences")}</SectionLabel>

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

                {generating && (
                    <Card style={styles.statusRow}>
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                        <Text style={styles.statusText}>{streamStatus ? statusLabel : t("ai.noStreamingHint")}</Text>
                        {streamStatus && (
                            <IconButton icon="close" size="sm" variant="tonal" label={t("common.cancel")} onPress={handleCancel} />
                        )}
                    </Card>
                )}

                {hasPlan && (
                    <>
                        <SectionLabel>{t("ai.planPreview")}</SectionLabel>
                        {grouped.map(([date, entries]) => (
                            <Card key={date} style={styles.dayCard}>
                                <Text style={styles.dayHeading}>{date}</Text>
                                {entries.map((entry, i) => (
                                    <View key={`${entry.food_id}-${i}`} style={styles.entryRow}>
                                        <View style={styles.entryMain}>
                                            <Text style={styles.entryFood} numberOfLines={1}>{entry.foodName}</Text>
                                            <Text style={styles.entryMeal}>{t(`meal.${entry.meal_type}`)}</Text>
                                        </View>
                                        <Text style={styles.entryDetail}>
                                            {Math.round(entry.quantity_grams)} g · {entry.calories} {t("common.kcal")}
                                        </Text>
                                    </View>
                                ))}
                            </Card>
                        ))}
                    </>
                )}
            </ScrollView>
            <FooterBar>
                {hasPlan && !generating && (
                    <Button title={t("ai.importPlan")} onPress={handleImport} loading={importing} />
                )}
                <Button
                    title={generating ? t("ai.generating") : t("ai.generatePlan")}
                    variant={hasPlan && !generating ? "outline" : "primary"}
                    onPress={handleGenerate}
                    loading={generating}
                />
            </FooterBar>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl },
        firstLabel: { marginTop: spacing.sm },
        field: { marginBottom: spacing.md },
        statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
        statusText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
        dayCard: { marginBottom: spacing.sm },
        dayHeading: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
        entryRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        entryMain: { flex: 1 },
        entryFood: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text },
        entryMeal: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },
        entryDetail: { fontSize: fontSize.xs, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
    });
}
