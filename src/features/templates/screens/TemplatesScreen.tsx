import type { ExerciseTemplate } from "@/src/features/exercise/services/exerciseTemplateDb";
import Chip from "@/src/shared/atoms/Chip";
import EmptyState from "@/src/shared/atoms/EmptyState";
import Fab from "@/src/shared/atoms/Fab";
import ActionSheet, { type ActionSheetItem } from "@/src/shared/components/ActionSheet";
import ChipRow from "@/src/shared/components/ChipRow";
import CollapsibleHeader from "@/src/shared/components/CollapsibleHeader";
import SearchBar from "@/src/shared/components/SearchBar";
import SectionHeader from "@/src/shared/components/SectionHeader";
import { useCollapsibleHeader } from "@/src/shared/hooks/useCollapsibleHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, type ThemeColors } from "@/src/utils/theme";
import { router, type Href } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
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
    const header = useCollapsibleHeader();

    // Stable, so the memoized rows are not re-rendered by a new callback.
    const openMenu = useCallback((kind: MenuTarget["kind"], data: Recipe | Food | ExerciseTemplate) => {
        const target = (
            kind === "recipe" ? { kind, recipe: data } : kind === "food" ? { kind, food: data } : { kind, exercise: data }
        ) as MenuTarget;
        setLastMenuTarget(target);
        setMenuTarget(target);
    }, []);

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

    function renderItem({ item, index }: { item: TemplateItem; index: number }) {
        return (
            <TemplateCard
                kind={item.kind}
                data={item.data}
                isFirst={index === 0}
                isLast={index === list.items.length - 1}
                subtitle={item.subtitle}
                macros={item.macros}
                onMenu={openMenu}
                variants={item.kind === "recipe" ? item.variants : undefined}
                expanded={item.kind === "recipe" && list.expandedIds.has(item.data.id)}
                onToggleExpand={item.kind === "recipe" ? list.toggleExpanded : undefined}
            />
        );
    }

    return (
        <View style={styles.screen}>
            <CollapsibleHeader
                header={header}
                title={t("templates.title")}
                summary={
                    <SearchBar
                        value={list.query}
                        onChangeText={list.setQuery}
                        placeholder={t("templates.searchPlaceholder")}
                        style={styles.search}
                    />
                }
                details={
                    <ChipRow>
                        {FILTERS.map((filter) => (
                            <Chip
                                key={filter.key}
                                label={t(filter.labelKey)}
                                icon={filter.icon}
                                selected={list.filter === filter.key}
                                onPress={() => list.toggleFilter(filter.key)}
                            />
                        ))}
                    </ChipRow>
                }
            />

            <Animated.FlatList
                {...header.scrollProps}
                data={list.items}
                keyExtractor={(item) => `${item.kind}-${item.data.id}`}
                contentContainerStyle={[styles.list, header.contentStyle]}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                    list.items.length > 0 ? (
                        // "+ ITEMS" adds like every other "+" heading (the same menu as the Fab);
                        // how many there are and how they are sorted sit on the right.
                        <SectionHeader
                            first
                            title={t("templates.items")}
                            onAdd={() => setIsCreateOpen(true)}
                            addLabel={t("templates.createNew")}
                            hint={`${list.items.length} · ${t("templates.sortedByName")}`}
                        />
                    ) : null
                }
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
        // Borderless: the header card is the field's frame.
        search: { borderWidth: 0, paddingHorizontal: 0, minHeight: 0, backgroundColor: "transparent" },
        list: { paddingHorizontal: screenPadding, paddingBottom: 104 },
    });
}
