import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CustomField } from "../helpers/customFields";
import type { ExerciseType } from "../types";

// The pieces both exercise cards and superset cards are built from, so the
// two read as one design.

interface CollapsedCardProps {
    index: number;
    title: string;
    isSuperset?: boolean;
    done: number;
    total: number;
    onExpand: () => void;
    onLongPress: () => void;
}

/** A card that is not being worked on: its name and how many of its sets are done. */
export function CollapsedCard({ index, title, isSuperset, done, total, onExpand, onLongPress }: CollapsedCardProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createCardStyles(colors), [colors]);
    const allDone = total > 0 && done === total;

    return (
        <Pressable
            style={({ pressed }) => [styles.card, styles.collapsed, allDone && styles.finished, pressed && styles.pressed]}
            onPress={onExpand}
            onLongPress={onLongPress}
            accessibilityRole="button"
        >
            <Text style={styles.collapsedOrder}>{index + 1}.</Text>
            <View style={styles.collapsedText}>
                <Text style={styles.collapsedName} numberOfLines={1}>{title}</Text>
                {isSuperset && <Text style={styles.kicker}>{t("exercise.superset.menuTitle")}</Text>}
            </View>
            <View style={[styles.badge, allDone && styles.badgeDone]}>
                <Text style={[styles.badgeText, allDone && styles.badgeTextDone]}>
                    {total === 0
                        ? t("exercise.exerciseCard.noSetsYet")
                        : t("exercise.exerciseCard.setsProgress", { completed: done, total })}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
        </Pressable>
    );
}

export interface CardTitleMember {
    key: string | number;
    name: string;
    /** "Last: 4 × 8 @ 75 kg", or that there is no history yet. */
    last: string;
    /** A superset member's letter ("A", "B"). */
    letter?: string;
}

interface CardTitleProps {
    index: number;
    members: CardTitleMember[];
    note?: string | null;
    onHistory: () => void;
    onMenu: () => void;
}

/** The head of an open card: number, exercise name(s) with last session, note, history and menu. */
export function CardTitle({ index, members, note, onHistory, onMenu }: CardTitleProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createCardStyles(colors), [colors]);

    return (
        <View style={styles.titleRow}>
            <Text style={styles.order}>{index + 1}.</Text>
            <View style={styles.titleText}>
                {members.map((m) => (
                    <View key={m.key}>
                        <View style={styles.nameLine}>
                            {m.letter ? (
                                <View style={styles.letter}>
                                    <Text style={styles.letterText}>{m.letter}</Text>
                                </View>
                            ) : null}
                            <Text style={styles.name} numberOfLines={2}>{m.name}</Text>
                        </View>
                        <Text style={styles.last} numberOfLines={1}>{m.last}</Text>
                    </View>
                ))}
                {note ? <Text style={styles.note} numberOfLines={3}>{note}</Text> : null}
            </View>
            <IconButton
                icon="stats-chart-outline"
                size="sm"
                color={colors.textTertiary}
                label={t("exercise.exerciseCard.history")}
                onPress={onHistory}
            />
            <IconButton
                icon="ellipsis-vertical"
                size="sm"
                color={colors.textTertiary}
                label={t("common.moreActions")}
                onPress={onMenu}
            />
        </View>
    );
}

interface SetColumnsProps {
    exerciseType: ExerciseType;
    customFields: CustomField[];
    /** Keep room for the rows' check/trash column; off for read-only cards, whose rows have none. */
    withActionColumn?: boolean;
}

/** Column headings over the set rows, matching `SetInputRow`'s cells. */
export function SetColumns({ exerciseType, customFields, withActionColumn = true }: SetColumnsProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createCardStyles(colors), [colors]);
    const useCustom = exerciseType === "other" && customFields.length > 0;

    return (
        <View style={styles.columns}>
            <Text style={[styles.columnText, styles.setCol]}>{t("exercise.exerciseCard.set")}</Text>
            {exerciseType === "weight" && (
                <Text style={[styles.columnText, styles.valueCol]}>{t("exercise.exerciseCard.weight")}</Text>
            )}
            {exerciseType !== "cardio" && !useCustom && (
                <Text style={[styles.columnText, styles.valueCol]}>{t("exercise.exerciseCard.reps")}</Text>
            )}
            {exerciseType === "cardio" && (
                <>
                    <Text style={[styles.columnText, styles.valueCol]}>{t("exercise.exerciseCard.duration")}</Text>
                    <Text style={[styles.columnText, styles.valueCol]}>{t("exercise.exerciseCard.distance")}</Text>
                </>
            )}
            {useCustom && customFields.map((f) => (
                <Text key={f.id} style={[styles.columnText, styles.valueCol]} numberOfLines={1}>
                    {f.name}{f.unit ? ` (${f.unit})` : ""}
                </Text>
            ))}
            {exerciseType !== "cardio" && !useCustom && (
                <Text style={[styles.columnText, styles.rirCol]}>{t("exercise.exerciseCard.rir")}</Text>
            )}
            {withActionColumn && <View style={styles.actionCol} />}
        </View>
    );
}

/** The bar along the bottom of an open card that adds a set. */
export function AddSetButton({ label, onPress }: { label: string; onPress: () => void }) {
    const colors = useThemeColors();
    const styles = useMemo(() => createCardStyles(colors), [colors]);
    return (
        <Pressable
            style={({ pressed }) => [styles.addSet, pressed && styles.pressed]}
            onPress={onPress}
            accessibilityRole="button"
        >
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={styles.addSetText}>{label}</Text>
        </Pressable>
    );
}

/** The frame of an open card; its long press picks the card up to reorder it. */
export function ExpandedCardFrame({ children, onLongPress }: { children: React.ReactNode; onLongPress: () => void }) {
    const colors = useThemeColors();
    const styles = useMemo(() => createCardStyles(colors), [colors]);
    return (
        <Pressable style={[styles.card, styles.expanded]} onLongPress={onLongPress} delayLongPress={250}>
            {children}
        </Pressable>
    );
}

/** The frame of a past session's card: an open card at rest, without the ink border of the one being worked on. */
export function ReadOnlyCardFrame({ children }: { children: React.ReactNode }) {
    const colors = useThemeColors();
    const styles = useMemo(() => createCardStyles(colors), [colors]);
    return <View style={[styles.card, styles.readOnly]}>{children}</View>;
}

/** The quiet line an open card shows while it has no sets. */
export function NoSetsLine() {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createCardStyles(colors), [colors]);
    return <Text style={styles.noSets}>{t("exercise.exerciseCard.noSetsYet")}</Text>;
}

function createCardStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
        },
        pressed: { opacity: 0.7 },

        // Collapsed
        collapsed: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 3,
            paddingVertical: spacing.sm + 5,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
        },
        finished: { opacity: 0.7 },
        collapsedOrder: { width: 18, fontSize: fontSize.xs, fontWeight: "600", color: colors.textTertiary },
        collapsedText: { flex: 1, minWidth: 0 },
        collapsedName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
        kicker: {
            marginTop: 3,
            fontSize: 9,
            fontWeight: "700",
            letterSpacing: 0.9,
            textTransform: "uppercase",
            color: colors.textTertiary,
        },
        badge: {
            paddingHorizontal: spacing.sm + 1,
            paddingVertical: 4,
            borderRadius: borderRadius.full,
            backgroundColor: colors.background,
        },
        badgeDone: { backgroundColor: colors.primary },
        badgeText: { fontSize: fontSize.xxs, fontWeight: "600", color: colors.textSecondary },
        badgeTextDone: { color: colors.onPrimary },

        // Expanded
        expanded: {
            borderWidth: 1.5,
            borderColor: colors.primary,
            paddingTop: spacing.sm + 6,
            marginBottom: spacing.sm + 4,
        },
        readOnly: { paddingBottom: spacing.xs, marginBottom: spacing.sm },
        // Open cards inset each part instead of padding the card (see SetInputRow).
        titleRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm + 2,
            paddingLeft: spacing.md,
            paddingRight: spacing.sm,
        },
        order: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, paddingTop: 1 },
        titleText: { flex: 1, minWidth: 0, gap: spacing.sm },
        nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
        letter: {
            width: 18,
            height: 18,
            borderRadius: 5,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },
        letterText: { fontSize: 10, fontWeight: "700", color: colors.onPrimary },
        name: { flexShrink: 1, fontSize: fontSize.md, fontWeight: "600", letterSpacing: -0.1, color: colors.text },
        last: { marginTop: 3, fontSize: fontSize.xs, color: colors.textTertiary },
        note: { fontSize: fontSize.xs, lineHeight: 18, fontStyle: "italic", color: colors.textSecondary },

        columns: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingTop: spacing.sm + 4,
            paddingBottom: spacing.xs + 2,
            marginHorizontal: spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        columnText: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: colors.textTertiary,
        },
        setCol: { width: 30 },
        valueCol: { flex: 1, textAlign: "center" },
        rirCol: { width: 40, textAlign: "center" },
        actionCol: { width: 30 },

        noSets: { paddingVertical: spacing.md, textAlign: "center", fontSize: fontSize.sm, color: colors.textTertiary },
        addSet: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.xs + 2,
            height: 44,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        addSetText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
    });
}
