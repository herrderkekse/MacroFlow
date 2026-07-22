// The single "foods" slide: every shared food as one checkable row. Unchecking
// skips a food (struck through); tapping expands it to choose log vs. library
// and where. "Import N foods" commits nothing — it just advances to the summary.

import type { ImportQueueApi } from "@/src/features/share/hooks/useImportQueue";
import type { FoodBatchItem } from "@/src/features/share/services/importPlan";
import { formatGrams } from "@/src/features/share/services/importPlan";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ImportMacros from "./ImportMacros";
import { DateRow, MealPicker } from "./ImportWhen";

interface Props {
    foods: FoodBatchItem[];
    api: ImportQueueApi;
    colors: ThemeColors;
    onOpenCalendar: () => void;
}

export default function ImportFoodBatch({ foods, api, colors, onOpenCalendar }: Props) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const includedCount = foods.filter((f) => api.foodChoices[f.id]?.include).length;

    return (
        <View style={styles.wrap}>
            <Text style={styles.summaryLine}>{t("share.import.foodSummary", { count: foods.length })}</Text>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                {foods.map((food, idx) => {
                    const choice = api.foodChoices[food.id];
                    const include = choice?.include ?? true;
                    const expanded = (choice?.expanded ?? false) && include;
                    const last = idx === foods.length - 1;
                    return (
                        <View key={food.id} style={[styles.row, expanded && styles.rowExpanded, !last && styles.rowDivider]}>
                            <View style={[styles.rowMain, !include && styles.rowMuted]}>
                                <Pressable onPress={() => api.toggleFoodImport(food.id)} hitSlop={6}>
                                    <View style={[styles.check, { borderColor: include ? colors.primary : colors.textTertiary }]}>
                                        {include ? <Ionicons name="checkmark" size={15} color={colors.primary} /> : null}
                                    </View>
                                </Pressable>
                                <Pressable style={styles.rowInfo} onPress={() => api.toggleFoodExpand(food.id)}>
                                    <Text style={[styles.title, !include && styles.struck]} numberOfLines={2}>
                                        {food.title}
                                    </Text>
                                    <Text style={[styles.serving, !include && styles.struck]}>{formatGrams(food.grams)}</Text>
                                    <View style={styles.metaRow}>
                                        <Ionicons name={metaIcon(include, choice?.addLog)} size={13} color={colors.textTertiary} />
                                        <Text style={styles.meta}>{metaLabel(include, choice?.addLog, api, choice?.meal, t)}</Text>
                                    </View>
                                </Pressable>
                                {include ? (
                                    <Pressable onPress={() => api.toggleFoodExpand(food.id)} hitSlop={6}>
                                        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textTertiary} />
                                    </Pressable>
                                ) : null}
                            </View>

                            {expanded ? (
                                <View style={styles.expand}>
                                    <ImportMacros macros={food.macros} colors={colors} />
                                    <Text style={styles.sectionLabel}>{t("share.import.addLogHeading")}</Text>
                                    <View style={styles.choiceRow}>
                                        <LogToggle
                                            label={t("share.import.logYes")}
                                            icon="today-outline"
                                            active={!!choice?.addLog}
                                            onPress={() => api.setFoodChoice(food.id, { addLog: true })}
                                            colors={colors}
                                        />
                                        <LogToggle
                                            label={t("share.import.templateOnly")}
                                            icon="bookmark-outline"
                                            active={!choice?.addLog}
                                            onPress={() => api.setFoodChoice(food.id, { addLog: false })}
                                            colors={colors}
                                        />
                                    </View>
                                    {choice?.addLog ? (
                                        <View style={styles.whenBlock}>
                                            <DateRow label={api.dateLabel} onPress={onOpenCalendar} colors={colors} />
                                            <MealPicker
                                                selected={choice.meal}
                                                onSelect={(m) => api.setFoodChoice(food.id, { meal: m })}
                                                colors={colors}
                                            />
                                        </View>
                                    ) : (
                                        <View style={styles.note}>
                                            <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
                                            <Text style={styles.noteText}>{t("share.import.templateOnlyNote")}</Text>
                                        </View>
                                    )}
                                </View>
                            ) : null}
                        </View>
                    );
                })}
            </ScrollView>

            <Pressable
                onPress={api.finishFoods}
                style={[styles.finish, { borderColor: includedCount > 0 ? colors.primary : colors.textTertiary }]}
            >
                <Ionicons name="checkmark-circle" size={18} color={includedCount > 0 ? colors.primary : colors.textTertiary} />
                <Text style={[styles.finishText, { color: includedCount > 0 ? colors.primary : colors.textTertiary }]}>
                    {includedCount > 0 ? t("share.import.importFoods", { count: includedCount }) : t("share.import.importNone")}
                </Text>
            </Pressable>
        </View>
    );
}

function metaIcon(include: boolean, addLog?: boolean): never {
    if (!include) return "close-circle" as never;
    return (addLog ? "today-outline" : "bookmark-outline") as never;
}

function metaLabel(
    include: boolean,
    addLog: boolean | undefined,
    api: ImportQueueApi,
    meal: string | undefined,
    t: (k: string, o?: any) => string,
): string {
    if (!include) return t("share.import.rowNotImporting");
    if (addLog) return `${api.dateLabel} · ${t(`meal.${meal ?? "snack"}`)}`;
    return t("share.import.rowLibraryOnly");
}

function LogToggle({
    label,
    icon,
    active,
    onPress,
    colors,
}: {
    label: string;
    icon: string;
    active: boolean;
    onPress: () => void;
    colors: ThemeColors;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={{
                flex: 1,
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                borderRadius: borderRadius.md,
                borderWidth: 1.5,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primaryLight : colors.surface,
            }}
        >
            <Ionicons name={icon as never} size={17} color={active ? colors.primary : colors.textSecondary} />
            <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: active ? colors.primary : colors.text }}>{label}</Text>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        wrap: { flex: 1 },
        summaryLine: { fontSize: fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, fontWeight: "500" },
        scroll: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
        },
        list: {},
        row: {},
        rowExpanded: { backgroundColor: colors.background },
        rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        rowMain: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm + 4, padding: spacing.md },
        rowMuted: { opacity: 0.6 },
        check: {
            width: 24,
            height: 24,
            marginTop: 2,
            borderRadius: 999,
            borderWidth: 1.5,
            alignItems: "center",
            justifyContent: "center",
        },
        rowInfo: { flex: 1, minWidth: 0 },
        title: { fontSize: fontSize.md, fontWeight: "700", color: colors.text, lineHeight: 21 },
        serving: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
        struck: { textDecorationLine: "line-through", color: colors.textTertiary },
        metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
        meta: { fontSize: 11, fontWeight: "500", color: colors.textTertiary },
        expand: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
        sectionLabel: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.6,
            color: colors.textSecondary,
            textTransform: "uppercase",
        },
        choiceRow: { flexDirection: "row", gap: spacing.sm },
        whenBlock: { gap: spacing.xs },
        note: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm,
            backgroundColor: colors.primaryLight,
            borderRadius: borderRadius.md,
            padding: spacing.sm + 2,
        },
        noteText: { flex: 1, fontSize: fontSize.xs, color: colors.text, lineHeight: 17 },
        finish: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            padding: spacing.md,
            marginTop: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1.5,
            backgroundColor: colors.surface,
        },
        finishText: { fontSize: fontSize.md, fontWeight: "700" },
    });
}
