import {
    deleteFood,
    deleteRecipe,
    getAllFoods,
    getAllRecipes,
    getRecipeItems,
    searchFoodsByName,
    searchRecipesByName,
    type Food,
    type Recipe,
} from "@/src/db/queries";
import logger from "@/src/utils/logger";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/utils/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, type Href } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

type FilterType = "all" | "recipes" | "foods";

type TemplateItem =
    | { kind: "food"; data: Food }
    | { kind: "recipe"; data: Recipe };

export default function RecipesScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState<TemplateItem[]>([]);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [filterExpanded, setFilterExpanded] = useState(false);

    function load() {
        const q = query.trim();
        const hasQuery = q.length >= 2;
        const result: TemplateItem[] = [];

        if (filter !== "foods") {
            const recipeList = hasQuery ? searchRecipesByName(q) : getAllRecipes();
            for (const r of recipeList) result.push({ kind: "recipe", data: r });
        }
        if (filter !== "recipes") {
            const foodList = hasQuery ? searchFoodsByName(q) : getAllFoods();
            for (const f of foodList) result.push({ kind: "food", data: f });
        }

        result.sort((a, b) => a.data.name.localeCompare(b.data.name));
        setItems(result);
    }

    useFocusEffect(useCallback(() => { load(); }, [query, filter]));

    function handleDeleteRecipe(recipe: Recipe) {
        Alert.alert(t("recipes.deleteRecipe"), t("recipes.removeRecipe", { name: recipe.name }), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("common.delete"),
                style: "destructive",
                onPress: () => {
                    deleteRecipe(recipe.id);
                    logger.info("[DB] Deleted recipe", { id: recipe.id });
                    load();
                },
            },
        ]);
    }

    function handleDeleteFood(food: Food) {
        Alert.alert(
            t("recipes.deleteFood"),
            t("recipes.removeFoodWarning", { name: food.name }),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: () => {
                        deleteFood(food.id);
                        logger.info("[DB] Deleted food", { id: food.id });
                        load();
                    },
                },
            ],
        );
    }

    function recipeSummary(recipeId: number) {
        const recipeItemsList = getRecipeItems(recipeId);
        if (recipeItemsList.length === 0) return t("recipes.noItems");
        const totalCals = recipeItemsList.reduce((sum, row) => {
            const food = row.foods;
            if (!food) return sum;
            return sum + (food.calories_per_100g * row.recipe_items.quantity_grams) / 100;
        }, 0);
        return `${recipeItemsList.length} item${recipeItemsList.length > 1 ? "s" : ""} · ${Math.round(totalCals)} cal`;
    }

    function foodSummary(food: Food) {
        return t("recipes.calPer100g", { cal: Math.round(food.calories_per_100g) });
    }

    function toggleFilter(type: "recipes" | "foods") {
        setFilter((prev) => (prev === type ? "all" : type));
    }

    function renderItem({ item }: { item: TemplateItem }) {
        if (item.kind === "recipe") {
            const recipe = item.data as Recipe;
            return (
                <Pressable
                    style={styles.card}
                    onPress={() => router.push({ pathname: "/recipes/edit", params: { recipeId: String(recipe.id) } } as unknown as Href)}
                >
                    <Ionicons name="book-outline" size={22} color={colors.primary} style={styles.cardIcon} />
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardName} numberOfLines={1}>{recipe.name}</Text>
                        <Text style={styles.cardSub}>{recipeSummary(recipe.id)}</Text>
                    </View>
                    <Pressable onPress={() => handleDeleteRecipe(recipe)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                </Pressable>
            );
        }
        const food = item.data as Food;
        return (
            <Pressable
                style={styles.card}
                onPress={() => router.push({ pathname: "/recipes/food-edit", params: { foodId: String(food.id) } } as unknown as Href)}
            >
                <Ionicons name="nutrition-outline" size={22} color={colors.success} style={styles.cardIcon} />
                <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{food.name}</Text>
                    <Text style={styles.cardSub}>{foodSummary(food)}</Text>
                </View>
                <Pressable onPress={() => handleDeleteFood(food)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
            </Pressable>
        );
    }

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <Text style={styles.heading}>{t("recipes.title")}</Text>
            <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t("recipes.searchPlaceholder")}
                    placeholderTextColor={colors.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                />
                {query.length > 0 && (
                    <Pressable onPress={() => setQuery("")} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                    </Pressable>
                )}
            </View>

            <Pressable
                onPress={() => setFilterExpanded((prev) => !prev)}
                style={styles.filterHeader}
            >
                <Text style={styles.filterLabel}>{t("recipes.filter")}</Text>
                <Ionicons
                    name={filterExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textSecondary}
                />
            </Pressable>
            {filterExpanded && (
                <View style={styles.filterRow}>
                    <Pressable
                        style={[styles.filterButton, filter === "recipes" && styles.filterButtonActive]}
                        onPress={() => toggleFilter("recipes")}
                    >
                        <Ionicons
                            name="book-outline"
                            size={16}
                            color={filter === "recipes" ? colors.primary : colors.textSecondary}
                            style={{ marginRight: spacing.xs }}
                        />
                        <Text style={[styles.filterButtonText, filter === "recipes" && styles.filterButtonTextActive]}>
                            {t("recipes.filterRecipes")}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.filterButton, filter === "foods" && styles.filterButtonActive]}
                        onPress={() => toggleFilter("foods")}
                    >
                        <Ionicons
                            name="nutrition-outline"
                            size={16}
                            color={filter === "foods" ? colors.primary : colors.textSecondary}
                            style={{ marginRight: spacing.xs }}
                        />
                        <Text style={[styles.filterButtonText, filter === "foods" && styles.filterButtonTextActive]}>
                            {t("recipes.filterFoods")}
                        </Text>
                    </Pressable>
                </View>
            )}

            <FlatList
                data={items}
                keyExtractor={(item) =>
                    item.kind === "recipe" ? `recipe-${item.data.id}` : `food-${item.data.id}`
                }
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {query ? t("recipes.noMatchingTemplates") : t("recipes.noTemplatesYet")}
                    </Text>
                }
                renderItem={renderItem}
            />

            <Pressable
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                onPress={() => router.push("/recipes/edit" as unknown as Href)}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </Pressable>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        heading: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
        },
        searchRow: {
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: spacing.md,
            marginBottom: spacing.xs,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
        },
        searchInput: {
            flex: 1,
            fontSize: fontSize.md,
            color: colors.text,
            padding: 0,
        },
        filterHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginHorizontal: spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
        },
        filterLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
        },
        filterRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginHorizontal: spacing.md,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
        },
        filterButton: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        filterButtonActive: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
        },
        filterButtonText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        filterButtonTextActive: {
            color: colors.primary,
            fontWeight: "600",
        },
        list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
        empty: {
            textAlign: "center",
            color: colors.textTertiary,
            marginTop: spacing.xl,
            fontSize: fontSize.sm,
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
        },
        cardIcon: { marginRight: spacing.sm },
        cardInfo: { flex: 1, marginRight: spacing.sm },
        cardName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
        cardSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
        fab: {
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
        },
        fabPressed: { opacity: 0.85 },
    });
}
