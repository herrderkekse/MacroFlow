import type { ExerciseTemplate } from "@/src/features/exercise/services/exerciseTemplateDb";
import Chip from "@/src/shared/atoms/Chip";
import EmptyState from "@/src/shared/atoms/EmptyState";
import Fab from "@/src/shared/atoms/Fab";
import ActionSheet, { type ActionSheetItem } from "@/src/shared/components/ActionSheet";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SearchBar from "@/src/shared/components/SearchBar";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, View } from "react-native";
import ForkRecipeSheet from "../components/ForkRecipeSheet";
import TemplateCard from "../components/TemplateCard";
import { useTemplateList, type TemplateItem } from "../hooks/useTemplateList";
import type { Food, Recipe } from "../services/templateDb";

/** What the "more" menu is currently open for. */
type MenuTarget =
    | { kind: "recipe"; recipe: Recipe }
    | { kind: "food"; food: Food }
    | { kind: "exercise"; exercise: ExerciseTemplate };

const FILTERS = [
    { key: "recipes", labelKey: "templates.filterRecipes", icon: "book-outline" },
    { key: "foods", labelKey: "templates.filterFoods", icon: "nutrition-outline" },
    { key: "exercises", labelKey: "templates.filterExercises", icon: "barbell-outline" },
] as const;

export default function TemplatesScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
    // Kept while the sheet slides out, so its rows do not vanish mid-animation.
    const [lastMenuTarget, setLastMenuTarget] = useState<MenuTarget | null>(null);

    const list = useTemplateList();

    function openMenu(target: MenuTarget) {
        setLastMenuTarget(target);
        setMenuTarget(target);
    }

    const createActions: ActionSheetItem[] = [
        {
            key: "food",
            icon: "nutrition-outline",
            label: t("templates.newFood"),
            description: t("templates.newFoodDescription"),
            onPress: () => router.push("/templates/food-edit" as unknown as Href),
        },
        {
            key: "recipe",
            icon: "book-outline",
            label: t("templates.newRecipe"),
            description: t("templates.newRecipeDescription"),
            onPress: () => router.push("/templates/edit" as unknown as Href),
        },
        {
            key: "exercise",
            icon: "barbell-outline",
            label: t("templates.newExercise"),
            description: t("templates.newExerciseDescription"),
            onPress: () => router.push("/templates/exercise-edit" as unknown as Href),
        },
    ];

    function menuActions(target: MenuTarget | null): ActionSheetItem[] {
        if (!target) return [];
        if (target.kind === "recipe") {
            return [
                {
                    key: "fork",
                    icon: "git-branch-outline",
                    label: t("templates.createVariant"),
                    onPress: () => list.setForkTarget({ recipe: target.recipe }),
                },
                {
                    key: "delete",
                    icon: "trash-outline",
                    label: t("common.delete"),
                    destructive: true,
                    onPress: () => list.handleDeleteRecipe(target.recipe),
                },
            ];
        }
        return [
            {
                key: "delete",
                icon: "trash-outline",
                label: t("common.delete"),
                destructive: true,
                onPress: () =>
                    target.kind === "food"
                        ? list.handleDeleteFood(target.food)
                        : list.handleDeleteExercise(target.exercise),
            },
        ];
    }

    function menuTitle(target: MenuTarget | null) {
        if (!target) return undefined;
        if (target.kind === "recipe") return target.recipe.name;
        return target.kind === "food" ? target.food.name : target.exercise.name;
    }

    function renderItem({ item }: { item: TemplateItem }) {
        if (item.kind === "recipe") {
            const recipe = item.data as Recipe;
            const subtitleParts = [list.recipeSummary(recipe.id)];
            if (item.variants.length > 0) {
                subtitleParts.push(t("templates.variantCount", { count: item.variants.length }));
            }
            return (
                <TemplateCard
                    kind="recipe"
                    data={recipe}
                    subtitle={subtitleParts.join(" · ")}
                    onMenu={() => openMenu({ kind: "recipe", recipe })}
                    variants={item.variants}
                    variantSubtitle={(v) => list.recipeSummary(v.id)}
                    expanded={list.expandedIds.has(recipe.id)}
                    onToggleExpand={() => list.toggleExpanded(recipe.id)}
                    onMenuVariant={(variant) => openMenu({ kind: "recipe", recipe: variant })}
                />
            );
        }

        if (item.kind === "exercise") {
            const exercise = item.data as ExerciseTemplate;
            return (
                <TemplateCard
                    kind="exercise"
                    data={exercise}
                    subtitle={list.exerciseSummary(exercise)}
                    onMenu={() => openMenu({ kind: "exercise", exercise })}
                />
            );
        }

        const food = item.data as Food;
        return (
            <TemplateCard
                kind="food"
                data={food}
                subtitle={list.foodSummary(food)}
                onMenu={() => openMenu({ kind: "food", food })}
            />
        );
    }

    return (
        <View style={styles.screen}>
            <ScreenHeader variant="large" title={t("templates.title")} subtitle={t("common.itemCount", { count: list.items.length })}>
                <SearchBar
                    value={list.query}
                    onChangeText={list.setQuery}
                    placeholder={t("templates.searchPlaceholder")}
                />
                <View style={styles.filterRow}>
                    {FILTERS.map((filter) => (
                        <Chip
                            key={filter.key}
                            label={t(filter.labelKey)}
                            icon={filter.icon}
                            selected={list.filter === filter.key}
                            onPress={() => list.toggleFilter(filter.key)}
                        />
                    ))}
                </View>
            </ScreenHeader>

            <FlatList
                data={list.items}
                keyExtractor={(item) => `${item.kind}-${item.data.id}`}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <EmptyState
                        icon={list.query ? "search-outline" : "library-outline"}
                        title={list.query ? t("templates.noMatchingTemplates") : t("templates.noTemplatesYet")}
                    />
                }
                renderItem={renderItem}
            />

            <Fab label={t("templates.createNew")} onPress={() => setIsCreateOpen(true)} />

            <ActionSheet
                visible={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title={t("templates.createNew")}
                actions={createActions}
            />

            <ActionSheet
                visible={!!menuTarget}
                onClose={() => setMenuTarget(null)}
                title={menuTitle(menuTarget ?? lastMenuTarget)}
                actions={menuActions(menuTarget ?? lastMenuTarget)}
            />

            <ForkRecipeSheet
                target={list.forkTarget}
                onClose={() => list.setForkTarget(null)}
                onSubmit={list.handleForkSubmit}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        filterRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm + 4 },
        list: { paddingHorizontal: screenPadding, paddingTop: spacing.xs, paddingBottom: 104 },
    });
}
