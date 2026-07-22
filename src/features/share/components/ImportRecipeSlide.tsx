// A single recipe slide in the import queue. Renders the recipe (or logged
// instance), and — for an entry whose ingredients diverged from the saved
// recipe — the two-step "save which template" → "log which version" flow. All
// choices go through the queue hook; nothing here writes to the DB.

import type { ImportQueueApi, RecipeSlide } from "@/src/features/share/hooks/useImportQueue";
import { formatGrams } from "@/src/features/share/services/importPlan";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import IngredientDiff from "./IngredientDiff";
import ImportMacros from "./ImportMacros";
import { DateRow, MealPicker } from "./ImportWhen";

interface Props {
    slide: RecipeSlide;
    api: ImportQueueApi;
    colors: ThemeColors;
    onOpenCalendar: () => void;
}

export default function ImportRecipeSlide({ slide, api, colors, onOpenCalendar }: Props) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const label = (key: string) => t(`share.import.${key}`);

    return (
        <View style={styles.card}>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
                {/* Badges */}
                <View style={styles.badges}>
                    <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="book-outline" size={14} color={colors.primary} />
                        <Text style={[styles.badgeText, { color: colors.primary }]}>
                            {slide.isEntry ? label("badgeEntry") : label("badgeRecipe")}
                        </Text>
                    </View>
                    {slide.isEntry ? (
                        <View style={[styles.chip, { borderColor: colors.border }]}>
                            <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                            <Text style={styles.chipText}>{t("share.import.wasMeal", { meal: t(`meal.${slide.originalMeal}`) })}</Text>
                        </View>
                    ) : null}
                    {slide.isEdited ? (
                        <View style={[styles.chip, { borderColor: colors.warning, backgroundColor: colors.background }]}>
                            <Ionicons name="git-compare-outline" size={13} color={colors.warning} />
                            <Text style={[styles.chipText, { color: colors.warning }]}>{label("editedBadge")}</Text>
                        </View>
                    ) : null}
                </View>

                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>
                    {t("share.import.ingredientCount", { count: slide.ingredientCount })} ·{" "}
                    {t("share.import.servings", { count: slide.portion })}
                </Text>
                <View style={styles.macros}>
                    <ImportMacros macros={slide.macros} colors={colors} />
                </View>

                {slide.isEdited ? (
                    <View style={styles.section}>
                        <IngredientDiff slide={slide} colors={colors} />
                    </View>
                ) : (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>
                            {t("share.import.ingredientsHeading", { count: slide.ingredientCount })}
                        </Text>
                        <View style={styles.list}>
                            {slide.base.items.map((item, i) => (
                                <View key={i} style={styles.ingRow}>
                                    <Ionicons name="ellipse" size={6} color={colors.textTertiary} />
                                    <Text style={styles.ingName} numberOfLines={1}>
                                        {item.food.name}
                                    </Text>
                                    <Text style={styles.ingQty}>{formatGrams(item.quantity_grams)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={styles.actions}>
                {slide.isEdited ? renderEditedActions() : renderPlainActions()}
            </View>
        </View>
    );

    function renderPlainActions() {
        return (
            <>
                <Text style={styles.actionLabel}>{label("addToHeading")}</Text>
                <View style={styles.whenBlock}>
                    <DateRow label={api.dateLabel} onPress={onOpenCalendar} colors={colors} />
                    <MealPicker selected={api.meal} onSelect={api.setMeal} colors={colors} />
                </View>
                <View style={styles.choiceRow}>
                    <ChoiceButton icon="bookmark-outline" label={label("libraryBtn")} onPress={api.saveRecipeLibrary} colors={colors} />
                    <ChoiceButton icon="add-circle-outline" label={label("logBtn")} onPress={api.logRecipe} colors={colors} />
                </View>
                <SkipLink label={label("skipItem")} onPress={api.skipRecipe} colors={colors} />
            </>
        );
    }

    function renderEditedActions() {
        if (api.editedPhase === "tpl") {
            return (
                <>
                    <Text style={styles.actionLabel}>
                        <Ionicons name="bookmark-outline" size={12} color={colors.textSecondary} /> {label("saveTemplateHeading")}
                    </Text>
                    <View style={styles.choiceRow}>
                        <ChoiceButton icon="book-outline" label={label("originalVersion")} onPress={() => api.saveTemplate("original")} colors={colors} />
                        <ChoiceButton icon="git-compare-outline" label={label("editedVersion")} onPress={() => api.saveTemplate("edited")} colors={colors} />
                    </View>
                    <SkipLink label={label("skipItem")} onPress={api.skipEdited} colors={colors} />
                </>
            );
        }
        // Log phase
        const pickVersion = api.savedVersion === null;
        return (
            <>
                <Text style={styles.actionLabel}>
                    <Ionicons name="today-outline" size={12} color={colors.primary} /> {label("logHeading")}
                </Text>
                <View style={styles.whenBlock}>
                    <DateRow label={api.dateLabel} onPress={onOpenCalendar} colors={colors} />
                    <MealPicker selected={api.meal} onSelect={api.setMeal} colors={colors} />
                </View>
                {pickVersion ? (
                    <>
                        <Text style={styles.actionLabel}>{label("logWhichVersion")}</Text>
                        <View style={styles.choiceRow}>
                            <ChoiceButton
                                icon="book-outline"
                                label={label("originalVersion")}
                                onPress={() => api.setLogVersion("original")}
                                colors={colors}
                                active={api.logVersion === "original"}
                            />
                            <ChoiceButton
                                icon="git-compare-outline"
                                label={label("editedVersion")}
                                onPress={() => api.setLogVersion("edited")}
                                colors={colors}
                                active={api.logVersion === "edited"}
                            />
                        </View>
                    </>
                ) : null}
                <View style={styles.choiceRow}>
                    <ChoiceButton icon="add-circle-outline" label={label("logBtn")} onPress={api.logEditedVersion} colors={colors} fill />
                </View>
                <SkipLink label={label("dontLog")} onPress={api.dontLogEdited} colors={colors} />
            </>
        );
    }
}

function ChoiceButton({
    icon,
    label,
    onPress,
    colors,
    active = false,
    fill = false,
}: {
    icon: string;
    label: string;
    onPress: () => void;
    colors: ThemeColors;
    active?: boolean;
    fill?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={{
                flex: 1,
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.xs,
                borderRadius: borderRadius.md,
                borderWidth: 1.5,
                borderColor: colors.primary,
                backgroundColor: active || fill ? colors.primaryLight : colors.surface,
            }}
        >
            <Ionicons name={icon as never} size={18} color={colors.primary} />
            <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: colors.primary }}>{label}</Text>
        </Pressable>
    );
}

function SkipLink({ label, onPress, colors }: { label: string; onPress: () => void; colors: ThemeColors }) {
    return (
        <Pressable onPress={onPress} hitSlop={6}>
            <Text style={{ textAlign: "center", paddingVertical: spacing.sm + 4, fontSize: fontSize.sm, fontWeight: "600", color: colors.textTertiary }}>
                {label}
            </Text>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
        },
        body: { flex: 1 },
        bodyContent: { padding: spacing.md },
        badges: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.sm },
        badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: 999 },
        badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
        chip: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: 4,
            borderRadius: 999,
            borderWidth: 1,
            backgroundColor: colors.background,
        },
        chipText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
        title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, lineHeight: 26 },
        subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
        macros: { marginTop: spacing.sm },
        section: { marginTop: spacing.md },
        sectionLabel: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.6,
            color: colors.textSecondary,
            textTransform: "uppercase",
            marginBottom: spacing.xs,
        },
        list: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, overflow: "hidden" },
        ingRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.sm + 4,
            paddingVertical: spacing.sm + 1,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        ingName: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
        ingQty: { fontSize: fontSize.xs, color: colors.textTertiary },
        actions: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
        actionLabel: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.6,
            color: colors.textSecondary,
            textTransform: "uppercase",
            marginBottom: spacing.sm,
        },
        whenBlock: { gap: spacing.xs, marginBottom: spacing.md },
        choiceRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs },
    });
}
