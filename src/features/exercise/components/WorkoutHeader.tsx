import Button from "@/src/shared/atoms/Button";
import Chip from "@/src/shared/atoms/Chip";
import IconButton from "@/src/shared/atoms/IconButton";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
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
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.row}>
                <IconButton icon="chevron-back" label={t("common.back")} onPress={onBack} />

                {editing ? (
                    <TextInput
                        style={styles.titleInput}
                        value={draft}
                        onChangeText={setDraft}
                        onBlur={commitTitle}
                        onSubmitEditing={commitTitle}
                        selectionColor={colors.textSecondary}
                        autoFocus
                        selectTextOnFocus
                        returnKeyType="done"
                    />
                ) : (
                    <Pressable
                        onPress={() => { setDraft(title); setEditing(true); }}
                        style={({ pressed }) => [styles.titleWrap, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("common.edit")}: ${title}`}
                    >
                        <Text style={styles.title} numberOfLines={1}>{title}</Text>
                        <Ionicons name="pencil" size={13} color={colors.textTertiary} />
                    </Pressable>
                )}

                <Chip label={formatElapsed(elapsedMs)} icon="time-outline" onPress={onTimerPress} />

                {!isFinished && (
                    <Button title={t("exercise.workout.finish")} size="sm" onPress={handleFinish} />
                )}
            </View>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { backgroundColor: colors.background },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: 56,
            paddingLeft: screenPadding - spacing.sm,
            paddingRight: screenPadding,
        },
        titleWrap: {
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs + 2,
        },
        pressed: { opacity: 0.6 },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            letterSpacing: -0.2,
            color: colors.text,
            flexShrink: 1,
        },
        titleInput: {
            flex: 1,
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            borderBottomWidth: 1,
            borderBottomColor: colors.primary,
            paddingVertical: 2,
        },
    });
}
