import Button from "@/src/shared/atoms/Button";
import AddPlaceholder from "@/src/shared/components/AddPlaceholder";
import FooterBar from "@/src/shared/components/FooterBar";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

interface WorkoutFooterProps {
    /** False once the workout is finished: then only adding is left. */
    isLive: boolean;
    /** Sets not marked done yet; finishing with any asks first. */
    openSets: number;
    onAddExercise: () => void;
    onFinish: () => void;
    /** Back to where the workout was opened from; it stays in progress. */
    onLeave: () => void;
}

/**
 * Pinned under the list, like the recipe editor's: add an exercise, then the
 * two ways out side by side — leave it running, or finish it.
 */
export default function WorkoutFooter({ isLive, openSets, onAddExercise, onFinish, onLeave }: WorkoutFooterProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [confirming, setConfirming] = useState(false);

    function handleFinish() {
        if (openSets > 0) setConfirming(true);
        else onFinish();
    }

    return (
        <FooterBar>
            <AddPlaceholder label={t("exercise.workout.addExercise")} onPress={onAddExercise} />
            {isLive && confirming && openSets > 0 && (
                // Not a dialog: it is a nudge, and finishing stays one tap away.
                <View style={styles.confirm}>
                    <Text style={styles.confirmText}>{t("exercise.workout.setsOpen", { count: openSets })}</Text>
                    <Button title={t("exercise.workout.keepGoing")} variant="ghost" size="sm" onPress={() => setConfirming(false)} />
                    <Button title={t("exercise.workout.finish")} size="sm" onPress={onFinish} />
                </View>
            )}
            {isLive && !(confirming && openSets > 0) && (
                <View style={styles.actions}>
                    <Button
                        title={t("exercise.workout.finishLater")}
                        variant="outline"
                        icon={<Ionicons name="exit-outline" size={17} color={colors.text} />}
                        onPress={onLeave}
                        style={styles.action}
                    />
                    <Button title={t("exercise.workout.finishWorkout")} onPress={handleFinish} style={styles.action} />
                </View>
            )}
        </FooterBar>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        confirm: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            minHeight: 48,
            paddingLeft: spacing.sm + 4,
            paddingRight: spacing.xs + 2,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        actions: { flexDirection: "row", gap: spacing.sm },
        action: { flex: 1 },
        confirmText: { flex: 1, fontSize: fontSize.xs, fontWeight: "500", color: colors.textSecondary },
    });
}
