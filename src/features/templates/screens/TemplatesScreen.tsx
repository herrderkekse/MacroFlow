import type { ExerciseTemplate } from "@/src/features/exercise/services/exerciseTemplateDb";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TemplateCard from "../components/TemplateCard";
import { useTemplateList, type TemplateItem } from "../hooks/useTemplateList";
import type { Food, Recipe } from "../services/templateDb";

export default function TemplatesScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();

    const list = useTemplateList();

    function renderItem({ item }: { item: TemplateItem }) {
        const subtitle =
            item.kind === "recipe" ? list.recipeSummary((item.data as Recipe).id) :
            item.kind === "exercise" ? list.exerciseSummary(item.data as ExerciseTemplate) :
            list.foodSummary(item.data as Food);

        const handleDelete =
            item.kind === "recipe" ? () => list.handleDeleteRecipe(item.data as Recipe) :
            item.kind === "exercise" ? () => list.handleDeleteExercise(item.data as ExerciseTemplate) :
            () => list.handleDeleteFood(item.data as Food);

        return (
            <TemplateCard
                kind={item.kind}
                data={item.data}
                subtitle={subtitle}
                onDelete={handleDelete}
            />
        );
    }

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <Text style={styles.heading}>{t("templates.title")}</Text>
            <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t("templates.searchPlaceholder")}
                    placeholderTextColor={colors.textTertiary}
                    value={list.query}
                    onChangeText={list.setQuery}
                />
                {list.query.length > 0 && (
                    <Pressable onPress={() => list.setQuery("")} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                    </Pressable>
                )}
            </View>

            <Pressable
                onPress={() => list.setFilterExpanded((prev) => !prev)}
                style={styles.filterHeader}
            >
                <Text style={styles.filterLabel}>{t("templates.filter")}</Text>
                <Ionicons
                    name={list.filterExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textSecondary}
                />
            </Pressable>
            {list.filterExpanded && (
                <View style={styles.filterRow}>
                    <Pressable
                        style={[styles.filterButton, list.filter === "recipes" && styles.filterButtonActive]}
                        onPress={() => list.toggleFilter("recipes")}
                    >
                        <Ionicons
                            name="book-outline"
                            size={16}
                            color={list.filter === "recipes" ? colors.primary : colors.textSecondary}
                            style={{ marginRight: spacing.xs }}
                        />
                        <Text style={[styles.filterButtonText, list.filter === "recipes" && styles.filterButtonTextActive]}>
                            {t("templates.filterRecipes")}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.filterButton, list.filter === "foods" && styles.filterButtonActive]}
                        onPress={() => list.toggleFilter("foods")}
                    >
                        <Ionicons
                            name="nutrition-outline"
                            size={16}
                            color={list.filter === "foods" ? colors.primary : colors.textSecondary}
                            style={{ marginRight: spacing.xs }}
                        />
                        <Text style={[styles.filterButtonText, list.filter === "foods" && styles.filterButtonTextActive]}>
                            {t("templates.filterFoods")}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.filterButton, list.filter === "exercises" && styles.filterButtonActive]}
                        onPress={() => list.toggleFilter("exercises")}
                    >
                        <Ionicons
                            name="barbell-outline"
                            size={16}
                            color={list.filter === "exercises" ? colors.primary : colors.textSecondary}
                            style={{ marginRight: spacing.xs }}
                        />
                        <Text style={[styles.filterButtonText, list.filter === "exercises" && styles.filterButtonTextActive]}>
                            {t("templates.filterExercises")}
                        </Text>
                    </Pressable>
                </View>
            )}

            <FlatList
                data={list.items}
                keyExtractor={(item) => `${item.kind}-${item.data.id}`}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {list.query ? t("templates.noMatchingTemplates") : t("templates.noTemplatesYet")}
                    </Text>
                }
                renderItem={renderItem}
            />

            <Pressable
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                onPress={() => list.setFabExpanded((prev) => !prev)}
            >
                <Ionicons name={list.fabExpanded ? "close" : "add"} size={28} color="#fff" />
            </Pressable>

            {list.fabExpanded && (
                <>
                    <Pressable style={styles.fabOverlay} onPress={() => list.setFabExpanded(false)} />

                    <Pressable
                        style={[styles.miniFab, styles.miniFabTop]}
                        onPress={() => {
                            list.setFabExpanded(false);
                            router.push("/templates/food-edit" as unknown as Href);
                        }}
                    >
                        <Ionicons name="nutrition-outline" size={20} color="#fff" />
                        <Text style={styles.miniFabLabel}>{t("templates.newFood")}</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.miniFab, styles.miniFabMiddle]}
                        onPress={() => {
                            list.setFabExpanded(false);
                            router.push("/templates/edit" as unknown as Href);
                        }}
                    >
                        <Ionicons name="book-outline" size={20} color="#fff" />
                        <Text style={styles.miniFabLabel}>{t("templates.newRecipe")}</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.miniFab, styles.miniFabBottom]}
                        onPress={() => {
                            list.setFabExpanded(false);
                            router.push("/templates/exercise-edit" as unknown as Href);
                        }}
                    >
                        <Ionicons name="barbell-outline" size={20} color="#fff" />
                        <Text style={styles.miniFabLabel}>{t("templates.newExercise")}</Text>
                    </Pressable>
                </>
            )}
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
        fabOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.3)",
        },
        miniFab: {
            position: "absolute",
            right: 24,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.primary,
            borderRadius: 28,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
        },
        miniFabTop: { bottom: 24 + 56 + spacing.md + (48 + spacing.sm) * 2 },
        miniFabMiddle: { bottom: 24 + 56 + spacing.md + 48 + spacing.sm },
        miniFabBottom: { bottom: 24 + 56 + spacing.md },
        miniFabLabel: {
            color: "#fff",
            fontSize: fontSize.sm,
            fontWeight: "600",
            marginLeft: spacing.sm,
        },
    });
}
