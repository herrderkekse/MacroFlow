import {
    type ExerciseTemplate,
    getAllExerciseTemplates,
    searchExerciseTemplates,
    softDeleteExerciseTemplate,
} from "@/src/features/exercise/services/exerciseTemplateDb";
import logger from "@/src/utils/logger";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import {
    deleteFood,
    deleteRecipe,
    getAllFoods,
    getAllRecipes,
    getRecipeItems,
    searchFoodsByName,
    searchRecipesByName,
    softDeleteFood,
    softDeleteRecipe,
    type Food,
    type Recipe,
} from "../services/templateDb";

type FilterType = "all" | "recipes" | "foods" | "exercises";

export type TemplateItem =
    | { kind: "food"; data: Food }
    | { kind: "recipe"; data: Recipe }
    | { kind: "exercise"; data: ExerciseTemplate };

export function useTemplateList() {
    const { t } = useTranslation();
    const [items, setItems] = useState<TemplateItem[]>([]);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [filterExpanded, setFilterExpanded] = useState(false);
    const [fabExpanded, setFabExpanded] = useState(false);

    const load = useCallback(() => {
        const q = query.trim();
        const hasQuery = q.length >= 2;
        const result: TemplateItem[] = [];

        if (filter === "all" || filter === "recipes") {
            const recipeList = hasQuery ? searchRecipesByName(q) : getAllRecipes();
            for (const r of recipeList) result.push({ kind: "recipe", data: r });
        }
        if (filter === "all" || filter === "foods") {
            const foodList = hasQuery ? searchFoodsByName(q) : getAllFoods();
            for (const f of foodList) result.push({ kind: "food", data: f });
        }
        if (filter === "all" || filter === "exercises") {
            const exerciseList = hasQuery ? searchExerciseTemplates(q) : getAllExerciseTemplates();
            for (const e of exerciseList) result.push({ kind: "exercise", data: e });
        }

        result.sort((a, b) => a.data.name.localeCompare(b.data.name));
        setItems(result);
    }, [filter, query]);

    useFocusEffect(load);

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
            t("templates.deleteExerciseConfirm", { name: exercise.name }),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: () => {
                        softDeleteExerciseTemplate(exercise.id);
                        logger.info("[DB] Soft-deleted exercise template", { id: exercise.id });
                        load();
                    },
                },
            ],
        );
    }

    function exerciseSummary(exercise: ExerciseTemplate) {
        const parts: string[] = [];
        if (exercise.type) parts.push(t(`exercise.types.${exercise.type}`));
        if (exercise.muscle_group) {
            const key = exercise.muscle_group === "full_body" ? "fullBody" : exercise.muscle_group;
            parts.push(t(`exercise.muscles.${key}`));
        }
        return parts.join(" · ") || t("templates.exercise");
    }

    function recipeSummary(recipeId: number) {
        const recipeItemsList = getRecipeItems(recipeId);
        if (recipeItemsList.length === 0) return t("templates.noItems");
        const totalCals = recipeItemsList.reduce((sum, row) => {
            const food = row.foods;
            if (!food) return sum;
            return sum + (food.calories_per_100g * row.recipe_items.quantity_grams) / 100;
        }, 0);
        return `${t("common.itemCount", { count: recipeItemsList.length })} · ${Math.round(totalCals)} ${t("common.cal")}`;
    }

    function foodSummary(food: Food) {
        return t("templates.calPer100g", { cal: Math.round(food.calories_per_100g) });
    }

    function toggleFilter(type: "recipes" | "foods" | "exercises") {
        setFilter((prev) => (prev === type ? "all" : type));
    }

    return {
        items,
        query,
        setQuery,
        filter,
        filterExpanded,
        setFilterExpanded,
        fabExpanded,
        setFabExpanded,
        handleDeleteRecipe,
        handleDeleteFood,
        handleDeleteExercise,
        recipeSummary,
        foodSummary,
        exerciseSummary,
        toggleFilter,
        reload: load,
    };
}
