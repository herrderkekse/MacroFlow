import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExerciseTemplate } from "../services/exerciseDb";

interface ExerciseRowProps {
    template: ExerciseTemplate;
    onPress: () => void;
}

export default function ExerciseRow({ template, onPress }: ExerciseRowProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createRowStyles(colors), [colors]);

    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.info}>
                <Text style={styles.name}>{template.name}</Text>
                {(template.muscle_group || template.equipment) && (
                    <Text style={styles.meta}>
                        {[template.muscle_group, template.equipment].filter(Boolean).join(" · ")}
                    </Text>
                )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
    );
}

function createRowStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        rowPressed: { backgroundColor: colors.primaryLight },
        info: { flex: 1 },
        name: { fontSize: fontSize.md, color: colors.text, fontWeight: "500" },
        meta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
    });
}
