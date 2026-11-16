import {
    type ExerciseTemplate,
    deleteExerciseTemplate,
    getAllExerciseTemplates,
    searchExerciseTemplates,
    softDeleteExerciseTemplate,
} from "@/src/features/exercise/services/exerciseTemplateDb";
import logger from "@/src/utils/logger";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import {
    exerciseSummary,
    foodMacros,
    recipeMacros,
    recipeSummary,
    type TemplateMacros,
    type TemplateVariant,
} from "../helpers/templateRows";
import { forkRecipe, getRecipeGroups } from "../services/recipeVariantsDb";
import {
    deleteFood,
    deleteRecipe,
    getAllFoods,
    getRecipeItemsByRecipe,
    searchFoodsByName,
    softDeleteFood,
    softDeleteRecipe,
    type Food,
    type Recipe,
} from "../services/templateDb";

type FilterType = "all" | "recipes" | "foods" | "exercises";

/**
 * One row of the library, with its subtitle and macros worked out when the
 * list loads — never during render, which would query the DB per row.
 */
export type TemplateItem =
    | { kind: "food"; data: Food; subtitle: string; macros: TemplateMacros }
    | { kind: "recipe"; data: Recipe; subtitle: string; macros: TemplateMacros | null; variants: TemplateVariant[] }
    | { kind: "exercise"; data: ExerciseTemplate; subtitle: string; macros?: undefined };

export interface ForkTarget {
    recipe: Recipe;
}

export function useTemplateList() {
    const { t } = useTranslation();
    const [items, setItems] = useState<TemplateItem[]>([]);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [forkTarget, setForkTarget] = useState<ForkTarget | null>(null);

    const load = useCallback(() => {
        const q = query.trim();
        const hasQuery = q.length >= 2;
        const result: TemplateItem[] = [];

        if (filter === "all" || filter === "recipes") {
            const itemsByRecipe = getRecipeItemsByRecipe();
            const describe = (recipe: Recipe) => {
                const rows = itemsByRecipe.get(recipe.id) ?? [];
                return { summary: recipeSummary(recipe, rows, t), macros: recipeMacros(recipe, rows) };
            };
            for (const group of getRecipeGroups(hasQuery ? q : undefined)) {
                const base = describe(group.recipe);
                const variants = group.variants.map((variant) => {
                    const info = describe(variant);
                    return { recipe: variant, subtitle: info.summary, calories: info.macros?.calories ?? null };
                });
                result.push({
                    kind: "recipe",
                    data: group.recipe,
                    subtitle: [
                        base.summary,
                        variants.length > 0 ? t("templates.variantCount", { count: variants.length }) : null,
                    ].filter(Boolean).join(" · "),
                    macros: base.macros,
                    variants,
                });
            }
        }
        if (filter === "all" || filter === "foods") {
            const foodList = hasQuery ? searchFoodsByName(q) : getAllFoods();
            const subtitle = t("templates.foodPer100g");
            for (const f of foodList) result.push({ kind: "food", data: f, subtitle, macros: foodMacros(f) });
        }
        if (filter === "all" || filter === "exercises") {
            const exerciseList = hasQuery ? searchExerciseTemplates(q) : getAllExerciseTemplates();
            for (const e of exerciseList) result.push({ kind: "exercise", data: e, subtitle: exerciseSummary(e, t) });
        }

        result.sort((a, b) => a.data.name.localeCompare(b.data.name));
        setItems(result);
    }, [filter, query, t]);

    useFocusEffect(load);

    // Stable, so memoized rows are not re-rendered by a new callback.
    const toggleExpanded = useCallback((recipeId: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(recipeId)) next.delete(recipeId);
            else next.add(recipeId);
            return next;
        });
    }, []);

    function handleForkSubmit(variantName: string) {
        if (!forkTarget) return;
        const variant = forkRecipe(forkTarget.recipe.id, variantName);
        logger.info("[DB] Forked recipe", { source: forkTarget.recipe.id, variant: variant.id });
        setForkTarget(null);
        if (variant.parent_recipe_id != null) {
            // Expand the group so the new variant is visible.
            setExpandedIds((prev) => new Set(prev).add(variant.parent_recipe_id!));
        }
        load();
    }

    function handleDeleteRecipe(recipe: Recipe) {
        Alert.alert(t("templates.deleteRecipe"), t("templates.deleteTitle"), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("templates.deleteFutureOnly"),
                onPress: () => {
                    softDeleteRecipe(recipe.id);
                    logger.info("[DB] Soft-deleted recipe", { id: recipe.id });
                    load();
                },
            },
            {
                text: t("templates.deleteEverything"),
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
            t("templates.deleteFood"),
            t("templates.deleteTitle"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("templates.deleteFutureOnly"),
                    onPress: () => {
                        softDeleteFood(food.id);
                        logger.info("[DB] Soft-deleted food", { id: food.id });
                        load();
                    },
                },
                {
                    text: t("templates.deleteEverything"),
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

    function handleDeleteExercise(exercise: ExerciseTemplate) {
        Alert.alert(
            t("templates.deleteExercise"),
            t("templates.deleteTitle"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("templates.deleteFutureOnly"),
                    onPress: () => {
                        softDeleteExerciseTemplate(exercise.id);
                        logger.info("[DB] Soft-deleted exercise template", { id: exercise.id });
                        load();
                    },
                },
                {
                    text: t("templates.deleteEverything"),
                    style: "destructive",
                    onPress: () => {
                        deleteExerciseTemplate(exercise.id);
                        logger.info("[DB] Deleted exercise template", { id: exercise.id });
                        load();
                    },
                },
            ],
        );
    }

    function toggleFilter(type: "recipes" | "foods" | "exercises") {
        setFilter((prev) => (prev === type ? "all" : type));
    }

    return {
        items,
        query,
        setQuery,
        filter,
        expandedIds,
        toggleExpanded,
        forkTarget,
        setForkTarget,
        handleForkSubmit,
        handleDeleteRecipe,
        handleDeleteFood,
        handleDeleteExercise,
        toggleFilter,
        reload: load,
    };
}
