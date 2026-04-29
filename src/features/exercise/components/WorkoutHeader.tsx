import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface WorkoutHeaderProps {
    title: string;
    elapsedMs: number;
    isFinished: boolean;
    hasUnfinishedSets: boolean;
    onTitleChange: (title: string) => void;
    onFinish: () => void;
    onBack: () => void;
    onTimerPress: () => void;
}

export default function WorkoutHeader({
    title, elapsedMs, isFinished, hasUnfinishedSets,
    onTitleChange, onFinish, onBack, onTimerPress,
}: WorkoutHeaderProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);

    function formatElapsed(ms: number): string {
        const totalMin = Math.floor(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, "0")}`;
        }
        return `${m} min`;
    }

    function handleFinish() {
        if (hasUnfinishedSets) {
            Alert.alert(
                t("exercise.workout.finish"),
                t("exercise.workout.finishConfirm"),
                [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("exercise.workout.finish"), style: "destructive", onPress: onFinish },
                ],
            );
        } else {
            onFinish();
        }
    }

    function commitTitle() {
        setEditing(false);
        if (draft.trim() && draft.trim() !== title) {
            onTitleChange(draft.trim());
        } else {
            setDraft(title);
        }
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top + spacing.xs }]}>
            <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>

            {editing ? (
                <TextInput
                    style={styles.titleInput}
                    value={draft}
                    onChangeText={setDraft}
                    onBlur={commitTitle}
                    onSubmitEditing={commitTitle}
                    autoFocus
                    selectTextOnFocus
                    returnKeyType="done"
                />
            ) : (
                <Pressable onPress={() => { setDraft(title); setEditing(true); }} style={styles.titleWrap}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                </Pressable>
            )}

            <Pressable style={styles.timerWrap} onPress={onTimerPress} hitSlop={8}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.timer}>{formatElapsed(elapsedMs)}</Text>
            </Pressable>

            {!isFinished && (
                <Pressable onPress={handleFinish} style={styles.finishBtn} hitSlop={8}>
                    <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
                </Pressable>
            )}
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        backBtn: {
            padding: spacing.xs,
        },
        titleWrap: {
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
        },
        title: {
            fontSize: fontSize.md,
            fontWeight: "700",
            color: colors.text,
            flexShrink: 1,
        },
        titleInput: {
            flex: 1,
            fontSize: fontSize.md,
            fontWeight: "700",
            color: colors.text,
            borderBottomWidth: 1,
            borderBottomColor: colors.primary,
            paddingVertical: 2,
        },
        timerWrap: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        timer: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            fontVariant: ["tabular-nums"],
        },
        finishBtn: {
            padding: spacing.xs,
        },
    });
}
