import {
    deleteRecipe,
    getAllRecipes,
    getRecipeItems,
    searchRecipesByName,
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

export default function RecipesScreen() {
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [query, setQuery] = useState("");

    function load() {
        const list = query.trim().length >= 2
            ? searchRecipesByName(query.trim())
            : getAllRecipes();
        setRecipes(list);
    }

    useFocusEffect(useCallback(() => { load(); }, [query]));

    function handleDelete(recipe: Recipe) {
        Alert.alert("Delete recipe", `Remove "${recipe.name}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    deleteRecipe(recipe.id);
                    logger.info("[DB] Deleted recipe", { id: recipe.id });
                    load();
                },
            },
        ]);
    }

    function summaryText(recipeId: number) {
        const items = getRecipeItems(recipeId);
        if (items.length === 0) return "No items";
        const totalCals = items.reduce((sum, row) => {
            const food = row.foods;
            if (!food) return sum;
            return sum + (food.calories_per_100g * row.recipe_items.quantity_grams) / 100;
        }, 0);
        return `${items.length} item${items.length > 1 ? "s" : ""} · ${Math.round(totalCals)} cal`;
    }

    return (
        <View style={styles.screen}>
            <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search recipes…"
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

            <FlatList
                data={recipes}
                keyExtractor={(r) => String(r.id)}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {query ? "No matching recipes" : "No recipes yet — tap + to create one"}
                    </Text>
                }
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.card}
                        onPress={() => router.push({ pathname: "/recipes/edit", params: { recipeId: String(item.id) } } as unknown as Href)}
                    >
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.cardSub}>{summaryText(item.id)}</Text>
                        </View>
                        <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={20} color={colors.danger} />
                        </Pressable>
                    </Pressable>
                )}
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
        searchRow: {
            flexDirection: "row",
            alignItems: "center",
            margin: spacing.md,
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
